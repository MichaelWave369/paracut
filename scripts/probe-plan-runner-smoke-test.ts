import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMediaProbeResult } from "../packages/media-probe-core/src/index";
import { saveProbeResultToCache } from "../packages/probe-cache-core/src/index";
import { planMediaProbesForProject, type ProbePlanItem } from "../packages/probe-planning-core/src/index";
import { runProbePlanWithRunner } from "../packages/probe-plan-runner-core/src/index";
import { createMockProbeRunner } from "../packages/probe-runner-core/src/index";
import { fingerprintSource } from "../packages/source-fingerprint-core/src/index";
import {
  createProject,
  getProjectMedia,
  importMediaToProject,
  type ParaCutProject,
} from "../packages/project-core/src/index";

async function main(): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "paracut-probe-plan-runner-"));

  try {
    const cachedUri = "cached.mp4";
    const needsProbeUri = "needs-probe.mp4";
    await writeFile(join(rootDir, cachedUri), "cached media bytes", "utf8");
    await writeFile(join(rootDir, needsProbeUri), "needs probe bytes", "utf8");

    let project = createProbeRunnerProject(cachedUri, needsProbeUri);

    const cachedFingerprint = await fingerprintSource({
      asset_id: "asset_cached",
      source_uri: cachedUri,
      project_root_dir: rootDir,
      fingerprinted_at: "2026-06-19T18:00:00.000Z",
    });
    expectEqual(cachedFingerprint.status, "fingerprinted", "cached asset should fingerprint");
    if (cachedFingerprint.status !== "fingerprinted") throw new Error("Expected cached fingerprint");
    const cachedSourceFingerprint = cachedFingerprint.fingerprint;

    const cachedProbe = createMediaProbeResult({
      asset_id: "asset_cached",
      source_uri: cachedUri,
      project_id: project.project_id,
      probe_id: "probe_cached_existing",
      source: "ffprobe",
      status: "probed",
      probed_at: "2026-06-19T18:00:01.000Z",
      container: { duration_seconds: 4, format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
      video: { codec: "h264", width: 640, height: 360, fps: 24 },
      audio: { codec: "aac", sample_rate: 48000, channels: 2 },
    });
    await saveProbeResultToCache(rootDir, {
      result: cachedProbe,
      source_fingerprint: cachedSourceFingerprint,
    });

    const plan = await planMediaProbesForProject(project, {
      project_root_dir: rootDir,
      plan_id: "probe_plan_runner_demo",
      planned_at: "2026-06-19T18:00:02.000Z",
    });

    expectEqual(plan.counts.cache_hit_count, 1, "plan should contain one cache-hit item");
    expectEqual(plan.counts.needs_probe_count, 1, "plan should contain one needs-probe item");

    const needsProbeItem = getPlanItem(plan.items, "asset_needs_probe");
    expectEqual(needsProbeItem.status, "needs-probe", "needs asset should require probe");

    const runner = createMockProbeRunner({
      runner_id: "mock-plan-runner",
      fixtures: [
        {
          asset_id: "asset_needs_probe",
          status: "completed",
          exit_code: 0,
          stdout: JSON.stringify(createFfprobePayload()),
          stderr: "",
          started_at: "2026-06-19T18:00:03.000Z",
          ended_at: "2026-06-19T18:00:04.000Z",
          duration_ms: 1000,
        },
      ],
    });

    const result = await runProbePlanWithRunner({
      project,
      plan,
      runner,
      requested_at: "2026-06-19T18:00:03.000Z",
      summary_created_at: "2026-06-19T18:00:05.000Z",
    });
    project = result.project;

    expectEqual(result.counts.item_count, 2, "runner result should cover every plan item");
    expectEqual(result.counts.executed_count, 1, "runner should execute only needs-probe items");
    expectEqual(result.counts.applied_count, 1, "runner should apply successful probe metadata");
    expectEqual(result.counts.cached_count, 1, "runner should cache successful probe metadata");
    expectEqual(result.counts.skipped_count, 1, "runner should skip cache-hit items");
    expectEqual(result.counts.failed_count, 0, "runner should not fail this plan");

    const needsResult = result.items.find((item) => item.asset_id === "asset_needs_probe");
    if (needsResult === undefined) throw new Error("needs-probe result should exist");
    expectEqual(needsResult.status, "applied", "needs-probe item should be applied");
    expectTrue(needsResult.request !== undefined, "applied item should include request");
    expectTrue(needsResult.probe !== undefined, "applied item should include probe");
    expectTrue(needsResult.cache_write !== undefined, "applied item should include cache write");

    const cachedResult = result.items.find((item) => item.asset_id === "asset_cached");
    if (cachedResult === undefined) throw new Error("cached result should exist");
    expectEqual(cachedResult.status, "skipped", "cache-hit item should not be re-run");
    expectEqual(cachedResult.skip_reason, "not-needs-probe", "cache-hit skip reason should be not-needs-probe");

    const enrichedAsset = getProjectMedia(project, "asset_needs_probe");
    if (enrichedAsset === undefined) throw new Error("enriched asset should exist");
    expectEqual(enrichedAsset.duration_seconds, 12.5, "duration should be applied from probe metadata");
    expectEqual(enrichedAsset.metadata?.width, 1920, "width should be applied from probe metadata");
    expectEqual(enrichedAsset.metadata?.height, 1080, "height should be applied from probe metadata");
    expectEqual(enrichedAsset.metadata?.codec, "h264", "codec should be applied from probe metadata");

    const stillUnappliedCachedAsset = getProjectMedia(project, "asset_cached");
    if (stillUnappliedCachedAsset === undefined) throw new Error("cached asset should exist");
    expectEqual(stillUnappliedCachedAsset.duration_seconds, undefined, "cache-hit item should remain untouched by runner bridge");

    const replan = await planMediaProbesForProject(project, {
      project_root_dir: rootDir,
      plan_id: "probe_plan_runner_recheck",
      planned_at: "2026-06-19T18:00:06.000Z",
    });
    expectEqual(replan.counts.cache_hit_count, 2, "after successful runner pass both local assets should be cache hits");
    expectEqual(replan.counts.needs_probe_count, 0, "after successful runner pass no local asset should need probing");

    const receiptTypes = project.ledger.map((receipt) => receipt.type);
    expectTrue(receiptTypes.includes("media.probe.executor.completed"), "executor receipt should be recorded");
    expectTrue(receiptTypes.includes("media.probe.completed"), "media probe application receipt should be recorded");
    expectTrue(receiptTypes.includes("media.probe.plan.runner.created"), "probe plan runner summary receipt should be recorded");

    console.log("ParaCut probe plan runner smoke passed");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

function createProbeRunnerProject(cachedUri: string, needsProbeUri: string): ParaCutProject {
  let project = createProject({
    project_id: "proj_probe_plan_runner",
    name: "Probe Plan Runner Smoke",
    created_at: "2026-06-19T18:00:00.000Z",
  });

  project = importMediaToProject(project, {
    asset_id: "asset_cached",
    kind: "video",
    name: "Cached Clip",
    uri: cachedUri,
    imported_at: "2026-06-19T18:00:00.000Z",
  });

  project = importMediaToProject(project, {
    asset_id: "asset_needs_probe",
    kind: "video",
    name: "Needs Probe Clip",
    uri: needsProbeUri,
    imported_at: "2026-06-19T18:00:00.000Z",
  });

  return project;
}

function getPlanItem(items: ProbePlanItem[], assetId: string): ProbePlanItem {
  const item = items.find((candidate) => candidate.asset_id === assetId);
  if (item === undefined) throw new Error(`Missing plan item for ${assetId}`);
  return item;
}

function createFfprobePayload(): Record<string, unknown> {
  return {
    format: {
      format_name: "mov,mp4,m4a,3gp,3g2,mj2",
      duration: "12.5",
      bit_rate: "6000000",
      size: "9375000",
    },
    streams: [
      {
        index: 0,
        codec_type: "video",
        codec_name: "h264",
        width: 1920,
        height: 1080,
        avg_frame_rate: "30000/1001",
        duration: "12.5",
        bit_rate: "5500000",
      },
      {
        index: 1,
        codec_type: "audio",
        codec_name: "aac",
        sample_rate: "48000",
        channels: 2,
        duration: "12.5",
        bit_rate: "192000",
      },
    ],
  };
}

function expectTrue(value: boolean, message: string): void {
  if (!value) throw new Error(message);
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
