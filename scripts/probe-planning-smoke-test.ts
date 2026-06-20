import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { createMediaProbeResult } from "../packages/media-probe-core/src/index";
import { saveProbeResultToCache } from "../packages/probe-cache-core/src/index";
import {
  planMediaProbesForProject,
  recordProbePlanOnProject,
  type ProbePlanItem,
  type ProbePlanItemStatus,
} from "../packages/probe-planning-core/src/index";
import { createProject, importMediaToProject, type ParaCutProject } from "../packages/project-core/src/index";
import { fingerprintSource, sourceFingerprintToProbeCacheInput } from "../packages/source-fingerprint-core/src/index";

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function findItem(items: ProbePlanItem[], status: ProbePlanItemStatus): ProbePlanItem {
  const item = items.find((candidate) => candidate.status === status);
  if (!item) throw new Error(`Missing probe plan item with status ${status}`);
  return item;
}

let project: ParaCutProject = createProject({
  project_id: "project_probe_plan_demo",
  name: "Probe Plan Smoke Demo",
  created_at: "2026-06-19T00:00:00.000Z",
});

const rootDir = join(tmpdir(), `paracut-probe-plan-${Date.now()}`);
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

const cachedProbe = createMediaProbeResult({
  asset_id: "asset_cached_video",
  source_uri: cachedUri,
  project_id: project.project_id,
  source: "mock",
  status: "probed",
  probed_at: "2026-06-19T00:06:00.000Z",
  container: { duration_seconds: 12, size_bytes: cachedFingerprint.size_bytes },
  video: { codec: "h264", width: 1920, height: 1080, fps: 30 },
});

const cacheInput = sourceFingerprintToProbeCacheInput(cachedFingerprint, "asset_cached_video");
await saveProbeResultToCache(rootDir, {
  result: cachedProbe,
  source_fingerprint: cacheInput.source_fingerprint,
  cached_at: "2026-06-19T00:07:00.000Z",
});

const plan = await planMediaProbesForProject(project, {
  project_root_dir: rootDir,
  plan_id: "probe_plan_smoke",
  planned_at: "2026-06-19T00:08:00.000Z",
});

expectEqual(plan.schema_version, "paracut.probe-plan.v0", "Probe plan schema should match");
expectEqual(plan.counts.item_count, 4, "Probe plan should include four media items");
expectEqual(plan.counts.cache_hit_count, 1, "Probe plan should find one cache hit");
expectEqual(plan.counts.needs_probe_count, 1, "Probe plan should find one needs-probe item");
expectEqual(plan.counts.missing_source_count, 1, "Probe plan should find one missing source");
expectEqual(plan.counts.unsupported_source_count, 1, "Probe plan should find one unsupported source");

const cacheHit = findItem(plan.items, "cache-hit");
expectEqual(cacheHit.asset_id, "asset_cached_video", "Cache-hit item should be the cached video");
expectTrue(cacheHit.cached_probe !== undefined, "Cache-hit item should include cached probe result");
expectEqual(cacheHit.cached_probe?.metadata?.video?.codec, "h264", "Cached probe metadata should be available on plan item");
expectTrue(cacheHit.cache_key !== undefined, "Cache-hit item should include cache key");

const needsProbe = findItem(plan.items, "needs-probe");
expectEqual(needsProbe.asset_id, "asset_needs_probe_audio", "Needs-probe item should be the uncached local audio");
expectTrue(needsProbe.cache_key !== undefined, "Needs-probe item should include the future cache key");
expectEqual(needsProbe.source_fingerprint?.status, "fingerprinted", "Needs-probe item should have a successful fingerprint");

const missing = findItem(plan.items, "missing-source");
expectEqual(missing.asset_id, "asset_missing_video", "Missing-source item should be the absent local video");
expectEqual(missing.source_fingerprint?.status, "missing", "Missing-source item should carry missing fingerprint status");

const unsupported = findItem(plan.items, "unsupported-source");
expectEqual(unsupported.asset_id, "asset_remote_video", "Unsupported item should be the remote video");
expectEqual(unsupported.source_fingerprint?.status, "unsupported", "Unsupported item should carry unsupported fingerprint status");

const receiptCountBefore = project.ledger.length;
const recorded = recordProbePlanOnProject(project, plan);
expectEqual(recorded.project.ledger.length, receiptCountBefore + 1, "Recording a probe plan should append one receipt");
expectEqual(recorded.project.updated_at, plan.created_at, "Recorded probe plan should update project timestamp");

await rm(rootDir, { recursive: true, force: true });

console.log("probe planning smoke ok", {
  plan_id: plan.plan_id,
  counts: plan.counts,
  receipts: recorded.project.ledger.length,
});
