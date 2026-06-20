import { appendReceipt, createReceipt } from "../../ledger-core/src/index";
import {
  applyMediaProbeResultToProject,
  pickDurationSeconds,
  type MediaProbeResult,
} from "../../media-probe-core/src/index";
import type { ProbePlan, ProbePlanItem, ProbePlanItemStatus } from "../../probe-planning-core/src/index";
import type { ParaCutProject } from "../../project-core/src/index";

export const CACHED_PROBE_APPLICATION_SCHEMA_VERSION = "paracut.cached-probe-application.v0" as const;

export type CachedProbeApplicationItemStatus = "applied" | "skipped";

export interface CachedProbeApplicationOptions {
  application_id?: string;
  applied_at?: string;
  record_summary_receipt?: boolean;
}

export interface CachedProbeApplicationItem {
  asset_id: string;
  plan_status: ProbePlanItemStatus;
  status: CachedProbeApplicationItemStatus;
  reason: string;
  probe_id?: string;
  cache_key?: string;
  duration_seconds?: number;
}

export interface CachedProbeApplicationCounts {
  item_count: number;
  applied_count: number;
  skipped_count: number;
}

export interface CachedProbeApplication {
  schema_version: typeof CACHED_PROBE_APPLICATION_SCHEMA_VERSION;
  application_id: string;
  plan_id: string;
  project_id: string;
  applied_at: string;
  items: CachedProbeApplicationItem[];
  counts: CachedProbeApplicationCounts;
}

export interface CachedProbeApplicationResult {
  project: ParaCutProject;
  application: CachedProbeApplication;
}

export function applyCachedProbePlanToProject(
  project: ParaCutProject,
  plan: ProbePlan,
  options: CachedProbeApplicationOptions = {},
): CachedProbeApplicationResult {
  if (plan.project_id !== project.project_id) {
    throw new Error(`Probe plan project_id ${plan.project_id} does not match project ${project.project_id}`);
  }

  const appliedAt = options.applied_at ?? new Date().toISOString();
  let nextProject = project;
  const items: CachedProbeApplicationItem[] = [];

  for (const item of plan.items) {
    const applied = applyCachedProbePlanItem(nextProject, item);
    nextProject = applied.project;
    items.push(applied.item);
  }

  const application: CachedProbeApplication = {
    schema_version: CACHED_PROBE_APPLICATION_SCHEMA_VERSION,
    application_id: options.application_id ?? createCachedProbeApplicationId(),
    plan_id: plan.plan_id,
    project_id: project.project_id,
    applied_at: appliedAt,
    items,
    counts: summarizeCachedProbeApplicationItems(items),
  };

  if (options.record_summary_receipt ?? true) {
    nextProject = {
      ...nextProject,
      updated_at: appliedAt,
      ledger: appendReceipt(nextProject.ledger, createCachedProbeApplicationReceipt(application)),
    };
  } else {
    nextProject = {
      ...nextProject,
      updated_at: appliedAt,
    };
  }

  return { project: nextProject, application };
}

export function summarizeCachedProbeApplicationItems(
  items: CachedProbeApplicationItem[],
): CachedProbeApplicationCounts {
  const appliedCount = items.filter((item) => item.status === "applied").length;
  return {
    item_count: items.length,
    applied_count: appliedCount,
    skipped_count: items.length - appliedCount,
  };
}

function applyCachedProbePlanItem(
  project: ParaCutProject,
  item: ProbePlanItem,
): { project: ParaCutProject; item: CachedProbeApplicationItem } {
  if (item.status !== "cache-hit") {
    return {
      project,
      item: createSkippedItem(item, reasonForSkippedPlanStatus(item.status)),
    };
  }

  if (item.cached_probe === undefined) {
    return {
      project,
      item: createSkippedItem(item, "Plan item is marked cache-hit but does not include cached probe metadata."),
    };
  }

  const cachedProbe = item.cached_probe;
  const guardReason = validateCachedProbeForPlanItem(project, item, cachedProbe);
  if (guardReason !== undefined) {
    return {
      project,
      item: createSkippedItem(item, guardReason, cachedProbe),
    };
  }

  const applied = applyMediaProbeResultToProject(project, cachedProbe);

  return {
    project: applied.project,
    item: createAppliedItem(item, cachedProbe),
  };
}

function validateCachedProbeForPlanItem(
  project: ParaCutProject,
  item: ProbePlanItem,
  cachedProbe: MediaProbeResult,
): string | undefined {
  if (cachedProbe.asset_id !== item.asset_id) {
    return `Cached probe asset_id ${cachedProbe.asset_id} does not match plan item ${item.asset_id}.`;
  }

  if (cachedProbe.project_id !== undefined && cachedProbe.project_id !== project.project_id) {
    return `Cached probe project_id ${cachedProbe.project_id} does not match project ${project.project_id}.`;
  }

  if (cachedProbe.status !== "probed") {
    return `Cached probe status ${cachedProbe.status} is not applicable; only probed cache results can enrich media.`;
  }

  if (cachedProbe.metadata === undefined) {
    return "Cached probe does not include metadata to apply.";
  }

  return undefined;
}

function createAppliedItem(item: ProbePlanItem, cachedProbe: MediaProbeResult): CachedProbeApplicationItem {
  const applicationItem: CachedProbeApplicationItem = {
    asset_id: item.asset_id,
    plan_status: item.status,
    status: "applied",
    reason: "Cached probe metadata applied to media asset.",
    probe_id: cachedProbe.probe_id,
  };

  if (item.cache_key !== undefined) applicationItem.cache_key = item.cache_key;
  if (cachedProbe.metadata !== undefined) {
    const duration = pickDurationSeconds(cachedProbe.metadata);
    if (duration !== undefined) applicationItem.duration_seconds = duration;
  }

  return applicationItem;
}

function createSkippedItem(
  item: ProbePlanItem,
  reason: string,
  cachedProbe?: MediaProbeResult,
): CachedProbeApplicationItem {
  const applicationItem: CachedProbeApplicationItem = {
    asset_id: item.asset_id,
    plan_status: item.status,
    status: "skipped",
    reason,
  };

  if (item.cache_key !== undefined) applicationItem.cache_key = item.cache_key;
  if (cachedProbe !== undefined) applicationItem.probe_id = cachedProbe.probe_id;

  return applicationItem;
}

function reasonForSkippedPlanStatus(status: ProbePlanItemStatus): string {
  if (status === "needs-probe") return "Probe cache miss; leave asset for a real probe executor.";
  if (status === "missing-source") return "Source is missing; cached probe metadata cannot be applied.";
  if (status === "unsupported-source") return "Source is unsupported for local fingerprint/cache application.";
  return "Plan item was not eligible for cached probe application.";
}

function createCachedProbeApplicationReceipt(application: CachedProbeApplication) {
  return createReceipt({
    type: "media.probe.cache.application.created",
    project_id: application.project_id,
    source: "system",
    approved_by: "system",
    created_at: application.applied_at,
    payload: {
      application_id: application.application_id,
      plan_id: application.plan_id,
      item_count: application.counts.item_count,
      applied_count: application.counts.applied_count,
      skipped_count: application.counts.skipped_count,
      items: application.items.map((item) => ({
        asset_id: item.asset_id,
        plan_status: item.plan_status,
        status: item.status,
        reason: item.reason,
        probe_id: item.probe_id ?? null,
        cache_key: item.cache_key ?? null,
        duration_seconds: item.duration_seconds ?? null,
      })),
    },
  });
}

function createCachedProbeApplicationId(): string {
  return `cached_probe_apply_${Date.now().toString(36)}`;
}
