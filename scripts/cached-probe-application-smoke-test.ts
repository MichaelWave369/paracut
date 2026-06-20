import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { applyCachedProbePlanToProject } from "../packages/cached-probe-application-core/src/index";
import { createMediaProbeResult } from "../packages/media-probe-core/src/index";
import { saveProbeResultToCache } from "../packages/probe-cache-core/src/index";
import { planMediaProbesForProject, type ProbePlanItemStatus } from "../packages/probe-planning-core/src/index";
import { createProject, getProjectMedia, importMediaToProject, type ParaCutProject } from "../packages/project-core/src/index";
import { fingerprintSource, sourceFingerprintToProbeCacheInput } from "../packages/source-fingerprint-core/src/index";

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function countApplicationItems(
  items: { plan_status: ProbePlanItemStatus; status: "applied" | "skipped" }[],
  planStatus: ProbePlanItemStatus,
  status: "applied" | "skipped",
): number {
  return items.filter((item) => item.plan_status === planStatus && item.status === status).length;
}

let project: ParaCutProject = createProject({
  project_id: "project_cached_probe_apply_demo",
  name: "Cached Probe Apply Smoke Demo",
  created_at: "2026-06-19T00:00:00.000Z",
});

const rootDir = join(tmpdir(), `paracut-cached-probe-apply-${Date.now()}`);
const mediaDir = join(rootDir, "media");
const cachedPath = join(mediaDir, "cached.mp4");
const needsProbePath = join(mediaDir, "needs-probe.wav");
const missingPath = join(mediaDir, "missing.mov");

await mkdir(mediaDir, { recursive: true });
await writeFile(cachedPath, "cached video bytes", "utf8");
await writeFile(needsProbePath, "audio bytes awaiting probe", "utf8");

const cachedUri = pathToFileURL(cachedPath).href;
const needsProbeUri = pathToFileURL(needsProbePath).href;
const missingUri = pathToFileURL(missingPath).href;
const remoteUri = "https://example.com/remote-video.mp4";

project = importMediaToProject(project, {
  asset_id: "asset_cached_video",
  kind: "video",
  name: "cached.mp4",
  uri: cachedUri,
  imported_at: "2026-06-19T00:01:00.000Z",
});
project = importMediaToProject(project, {
  asset_id: "asset_needs_probe_audio",
  kind: "audio",
  name: "needs-probe.wav",
  uri: needsProbeUri,
  imported_at: "2026-06-19T00:02:00.000Z",
});
project = importMediaToProject(project, {
  asset_id: "asset_missing_video",
  kind: "video",
  name: "missing.mov",
  uri: missingUri,
  imported_at: "2026-06-19T00:03:00.000Z",
});
project = importMediaToProject(project, {
  asset_id: "asset_remote_video",
  kind: "video",
  name: "remote-video.mp4",
  uri: remoteUri,
  imported_at: "2026-06-19T00:04:00.000Z",
});

const cachedFingerprint = await fingerprintSource({
  asset_id: "asset_cached_video",
  source_uri: cachedUri,
  project_root_dir: rootDir,
  fingerprinted_at: "2026-06-19T00:05:00.000Z",
});
expectEqual(cachedFingerprint.status, "fingerprinted", "Cached source should fingerprint");
expectTrue(cachedFingerprint.fingerprint !== undefined, "Cached source should include fingerprint string");
expectTrue(cachedFingerprint.size_bytes !== undefined, "Cached source should include file size");
const cachedSourceFingerprint = cachedFingerprint.fingerprint;
const cachedSizeBytes = cachedFingerprint.size_bytes;
if (cachedSourceFingerprint === undefined || cachedSizeBytes === undefined) {
  throw new Error("Cached source fingerprint was not narrowed");
}

const cachedProbe = createMediaProbeResult({
  asset_id: "asset_cached_video",
  source_uri: cachedUri,
  project_id: project.project_id,
  source: "mock",
  status: "probed",
  probed_at: "2026-06-19T00:06:00.000Z",
  container: { duration_seconds: 12, size_bytes: cachedSizeBytes },
  video: { codec: "h264", width: 1920, height: 1080, fps: 30 },
  audio: { codec: "aac", sample_rate: 48000, channels: 2 },
});

sourceFingerprintToProbeCacheInput(cachedFingerprint, "asset_cached_video");
await saveProbeResultToCache(rootDir, {
  result: cachedProbe,
  source_fingerprint: cachedSourceFingerprint,
  cached_at: "2026-06-19T00:07:00.000Z",
});

const plan = await planMediaProbesForProject(project, {
  project_root_dir: rootDir,
  plan_id: "probe_plan_cached_apply_smoke",
  planned_at: "2026-06-19T00:08:00.000Z",
});
expectEqual(plan.counts.cache_hit_count, 1, "Probe plan should find one cache hit");
expectEqual(plan.counts.needs_probe_count, 1, "Probe plan should find one needs-probe item");
expectEqual(plan.counts.missing_source_count, 1, "Probe plan should find one missing source");
expectEqual(plan.counts.unsupported_source_count, 1, "Probe plan should find one unsupported source");

const receiptCountBefore = project.ledger.length;
const applied = applyCachedProbePlanToProject(project, plan, {
  application_id: "cached_probe_application_smoke",
  applied_at: "2026-06-19T00:09:00.000Z",
});

expectEqual(applied.application.schema_version, "paracut.cached-probe-application.v0", "Application schema should match");
expectEqual(applied.application.counts.item_count, 4, "Application should include four plan items");
expectEqual(applied.application.counts.applied_count, 1, "Application should apply exactly one cached probe");
expectEqual(applied.application.counts.skipped_count, 3, "Application should skip all non-cache-hit items");
expectEqual(countApplicationItems(applied.application.items, "cache-hit", "applied"), 1, "Cache-hit item should apply");
expectEqual(countApplicationItems(applied.application.items, "needs-probe", "skipped"), 1, "Needs-probe item should be skipped");
expectEqual(countApplicationItems(applied.application.items, "missing-source", "skipped"), 1, "Missing-source item should be skipped");
expectEqual(countApplicationItems(applied.application.items, "unsupported-source", "skipped"), 1, "Unsupported-source item should be skipped");

const cachedAsset = getProjectMedia(applied.project, "asset_cached_video");
const needsProbeAsset = getProjectMedia(applied.project, "asset_needs_probe_audio");
const missingAsset = getProjectMedia(applied.project, "asset_missing_video");
const remoteAsset = getProjectMedia(applied.project, "asset_remote_video");

expectEqual(cachedAsset?.duration_seconds, 12, "Cached asset duration should be applied");
expectEqual(cachedAsset?.metadata?.width, 1920, "Cached asset width should be applied");
expectEqual(cachedAsset?.metadata?.height, 1080, "Cached asset height should be applied");
expectEqual(cachedAsset?.metadata?.sample_rate, 48000, "Cached asset audio metadata should be applied");
expectEqual(needsProbeAsset?.duration_seconds, undefined, "Needs-probe asset should not be enriched");
expectEqual(missingAsset?.duration_seconds, undefined, "Missing asset should not be enriched");
expectEqual(remoteAsset?.duration_seconds, undefined, "Unsupported remote asset should not be enriched");

expectEqual(applied.project.ledger.length, receiptCountBefore + 2, "Cached application should append probe receipt and summary receipt");
expectTrue(
  applied.project.ledger.some((receipt) => receipt.type === "media.probe.completed"),
  "Applying cached probe should write a completed probe receipt",
);
expectTrue(
  applied.project.ledger.some((receipt) => receipt.type === "media.probe.cache.application.created"),
  "Applying cached plan should write a cache application summary receipt",
);
expectEqual(applied.project.updated_at, "2026-06-19T00:09:00.000Z", "Summary application should update project timestamp");

await rm(rootDir, { recursive: true, force: true });

console.log("cached probe application smoke ok", {
  plan_id: plan.plan_id,
  counts: applied.application.counts,
  receipts: applied.project.ledger.length,
});
