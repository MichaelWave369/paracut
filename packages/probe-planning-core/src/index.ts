import { appendReceipt, createReceipt } from "../../ledger-core/src/index";
import type { MediaAsset } from "../../media-core/src/index";
import type { MediaProbeResult } from "../../media-probe-core/src/index";
import {
  createProbeCacheKey,
  loadProbeResultFromCache,
  type ProbeCacheKeyInput,
} from "../../probe-cache-core/src/index";
import type { ParaCutProject } from "../../project-core/src/index";
import {
  fingerprintSource,
  sourceFingerprintToProbeCacheInput,
  type SourceFingerprint,
} from "../../source-fingerprint-core/src/index";

export const PROBE_PLAN_SCHEMA_VERSION = "paracut.probe-plan.v0" as const;

export type ProbePlanItemStatus = "cache-hit" | "needs-probe" | "missing-source" | "unsupported-source";

export interface ProbePlanAssetOptions {
  project_root_dir: string;
  planned_at?: string;
}

export interface ProbePlanProjectOptions extends ProbePlanAssetOptions {
  plan_id?: string;
  include_kinds?: MediaAsset["kind"][];
}

export interface ProbePlanItem {
  schema_version: typeof PROBE_PLAN_SCHEMA_VERSION;
  asset_id: string;
  kind: MediaAsset["kind"];
  name: string;
  source_uri: string;
  normalized_uri?: string;
  status: ProbePlanItemStatus;
  planned_at: string;
  reason: string;
  source_fingerprint?: SourceFingerprint;
  cache_key_input?: ProbeCacheKeyInput;
  cache_key?: string;
  cached_probe?: MediaProbeResult;
}

export interface ProbePlanCounts {
  item_count: number;
  cache_hit_count: number;
  needs_probe_count: number;
  missing_source_count: number;
  unsupported_source_count: number;
}

export interface ProbePlan {
  schema_version: typeof PROBE_PLAN_SCHEMA_VERSION;
  plan_id: string;
  project_id: string;
  project_root_dir: string;
  created_at: string;
  items: ProbePlanItem[];
  counts: ProbePlanCounts;
}

export interface RecordProbePlanResult {
  project: ParaCutProject;
  plan: ProbePlan;
}

export async function planProbeForAsset(
  asset: MediaAsset,
  options: ProbePlanAssetOptions,
): Promise<ProbePlanItem> {
  if (!options.project_root_dir.trim()) throw new Error("Probe planning requires project_root_dir");

  const plannedAt = options.planned_at ?? new Date().toISOString();
  const fingerprint = await fingerprintSource({
    asset_id: asset.asset_id,
    source_uri: asset.uri,
    project_root_dir: options.project_root_dir,
    fingerprinted_at: plannedAt,
  });

  if (fingerprint.status === "missing") {
    return createProbePlanItem(asset, {
      status: "missing-source",
      planned_at: plannedAt,
      reason: fingerprint.reason ?? "Local source is missing.",
      source_fingerprint: fingerprint,
    });
  }

  if (fingerprint.status === "unsupported") {
    return createProbePlanItem(asset, {
      status: "unsupported-source",
      planned_at: plannedAt,
      reason: fingerprint.reason ?? "Source cannot be fingerprinted locally.",
      source_fingerprint: fingerprint,
    });
  }

  const cacheKeyInput = sourceFingerprintToProbeCacheInput(fingerprint, asset.asset_id);
  const cacheKey = createProbeCacheKey(cacheKeyInput);
  const cachedProbe = await loadProbeResultFromCache(options.project_root_dir, cacheKeyInput);

  if (cachedProbe !== undefined) {
    return createProbePlanItem(asset, {
      status: "cache-hit",
      planned_at: plannedAt,
      reason: "Probe result is already cached for the current source fingerprint.",
      source_fingerprint: fingerprint,
      cache_key_input: cacheKeyInput,
      cache_key: cacheKey,
      cached_probe: cachedProbe,
    });
  }

  return createProbePlanItem(asset, {
    status: "needs-probe",
    planned_at: plannedAt,
    reason: "Source is fingerprinted but no matching probe cache record exists.",
    source_fingerprint: fingerprint,
    cache_key_input: cacheKeyInput,
    cache_key: cacheKey,
  });
}

export async function planMediaProbesForProject(
  project: ParaCutProject,
  options: ProbePlanProjectOptions,
): Promise<ProbePlan> {
  if (!options.project_root_dir.trim()) throw new Error("Probe planning requires project_root_dir");

  const createdAt = options.planned_at ?? new Date().toISOString();
  const includeKinds = options.include_kinds ?? ["video", "audio", "image", "subtitle"];
  const includeSet = new Set<MediaAsset["kind"]>(includeKinds);
  const assets = project.media.assets.filter((asset) => includeSet.has(asset.kind));
  const items: ProbePlanItem[] = [];

  for (const asset of assets) {
    items.push(await planProbeForAsset(asset, {
      project_root_dir: options.project_root_dir,
      planned_at: createdAt,
    }));
  }

  return {
    schema_version: PROBE_PLAN_SCHEMA_VERSION,
    plan_id: options.plan_id ?? createProbePlanId(),
    project_id: project.project_id,
    project_root_dir: options.project_root_dir,
    created_at: createdAt,
    items,
    counts: summarizeProbePlanItems(items),
  };
}

export function summarizeProbePlanItems(items: ProbePlanItem[]): ProbePlanCounts {
  return {
    item_count: items.length,
    cache_hit_count: countItems(items, "cache-hit"),
    needs_probe_count: countItems(items, "needs-probe"),
    missing_source_count: countItems(items, "missing-source"),
    unsupported_source_count: countItems(items, "unsupported-source"),
  };
}

export function recordProbePlanOnProject(project: ParaCutProject, plan: ProbePlan): RecordProbePlanResult {
  if (plan.project_id !== project.project_id) {
    throw new Error(`Probe plan project_id ${plan.project_id} does not match project ${project.project_id}`);
  }

  const receipt = createReceipt({
    type: "media.probe.plan.created",
    project_id: project.project_id,
    source: "system",
    approved_by: "system",
    created_at: plan.created_at,
    payload: {
      plan_id: plan.plan_id,
      project_root_dir: plan.project_root_dir,
      item_count: plan.counts.item_count,
      cache_hit_count: plan.counts.cache_hit_count,
      needs_probe_count: plan.counts.needs_probe_count,
      missing_source_count: plan.counts.missing_source_count,
      unsupported_source_count: plan.counts.unsupported_source_count,
      items: plan.items.map((item) => ({
        asset_id: item.asset_id,
        kind: item.kind,
        source_uri: item.source_uri,
        status: item.status,
        reason: item.reason,
        cache_key: item.cache_key ?? null,
        fingerprint_status: item.source_fingerprint?.status ?? null,
      })),
    },
  });

  return {
    plan,
    project: {
      ...project,
      updated_at: plan.created_at,
      ledger: appendReceipt(project.ledger, receipt),
    },
  };
}

function createProbePlanItem(
  asset: MediaAsset,
  input: {
    status: ProbePlanItemStatus;
    planned_at: string;
    reason: string;
    source_fingerprint?: SourceFingerprint;
    cache_key_input?: ProbeCacheKeyInput;
    cache_key?: string;
    cached_probe?: MediaProbeResult;
  },
): ProbePlanItem {
  const item: ProbePlanItem = {
    schema_version: PROBE_PLAN_SCHEMA_VERSION,
    asset_id: asset.asset_id,
    kind: asset.kind,
    name: asset.name,
    source_uri: asset.uri,
    status: input.status,
    planned_at: input.planned_at,
    reason: input.reason,
  };

  if (input.source_fingerprint !== undefined) {
    item.source_fingerprint = input.source_fingerprint;
    item.normalized_uri = input.source_fingerprint.normalized_uri;
  }
  if (input.cache_key_input !== undefined) item.cache_key_input = input.cache_key_input;
  if (input.cache_key !== undefined) item.cache_key = input.cache_key;
  if (input.cached_probe !== undefined) item.cached_probe = input.cached_probe;

  return item;
}

function countItems(items: ProbePlanItem[], status: ProbePlanItemStatus): number {
  return items.filter((item) => item.status === status).length;
}

function createProbePlanId(): string {
  return `probe_plan_${Date.now().toString(36)}`;
}
