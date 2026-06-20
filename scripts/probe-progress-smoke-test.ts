import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMediaProbeResult } from "../packages/media-probe-core/src/index";
import { saveProbeResultToCache } from "../packages/probe-cache-core/src/index";
import { planMediaProbesForProject, type ProbePlanItem } from "../packages/probe-planning-core/src/index";
import { runProbePlanWithRunner } from "../packages/probe-plan-runner-core/src/index";
import {
  createProbeProgressBatchFromPlanRunnerResult,
  createProbeProgressEventsFromPlanRunnerResult,
  isTerminalProbeProgressEvent,
  summarizeProbeProgressEvents,
} from "../packages/probe-progress-core/src/index";
import { createMockProbeRunner } from "../packages/probe-runner-core/src/index";
import { fingerprintSource } from "../packages/source-fingerprint-core/src/index";
import {
  createProject,
  importMediaToProject,
  type ParaCutProject,
} from "../packages/project-core/src/index";

async function main(): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "paracut-probe-progress-"));

  try {
    const cachedUri = "cached.mp4";
    const successUri = "success.mp4";
    const failureUri = "failure.mp4";
    const remoteUri = "https://example.com/remote.mp4";

    await writeFile(join(rootDir, cachedUri), "cached media bytes", "utf8");
    await writeFile(join(rootDir, successUri), "successful media bytes", "utf8");
    await writeFile(join(rootDir, failureUri), "failing media bytes", "utf8");

    const project = createProbeProgressProject(cachedUri, successUri, failureUri, remoteUri);

    const cachedFingerprint = await fingerprintSource({
      asset_id: "asset_cached",
      source_uri: cachedUri,
      project_root_dir: rootDir,
      fingerprinted_at: "2026-06-19T19:00:00.000Z",
    });
    expectEqual(cachedFingerprint.status, "fingerprinted", "cached asset should fingerprint");
    if (cachedFingerprint.status !== "fingerprinted") throw new Error("Expected cached fingerprint");

    const cachedProbe = createMediaProbeResult({
      asset_id: "asset_cached",
      source_uri: cachedUri,
      project_id: project.project_id,
      probe_id: "probe_progress_cached_existing",
      source: "ffprobe",
      status: "probed",
      probed_at: "2026-06-19T19:00:01.000Z",
      container: { duration_seconds: 4, format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
      video: { codec: "h264", width: 640, height: 360, fps: 24 },
      audio: { codec: "aac", sample_rate: 48000, channels: 2 },
    });
    await saveProbeResultToCache(rootDir, {
      result: cachedProbe,
      source_fingerprint: cachedFingerprint.fingerprint,
    });

    const plan = await planMediaProbesForProject(project, {
      project_root_dir: rootDir,
      plan_id: "probe_progress_plan",
      planned_at: "2026-06-19T19:00:02.000Z",
    });

    expectEqual(plan.counts.cache_hit_count, 1, "plan should include one cache hit");
    expectEqual(plan.counts.needs_probe_count, 2, "plan should include two needs-probe assets");
    expectEqual(plan.counts.unsupported_source_count, 1, "plan should include one unsupported remote asset");
    expectEqual(getPlanItem(plan.items, "asset_remote").status, "unsupported-source", "remote asset should be unsupported");

    const runner = createMockProbeRunner({
      runner_id: "mock-progress-runner",
      fixtures: [
        {
          asset_id: "asset_success",
          status: "completed",
          exit_code: 0,
          stdout: JSON.stringify(createFfprobePayload()),
          stderr: "",
          started_at: "2026-06-19T19:00:03.000Z",
          ended_at: "2026-06-19T19:00:04.000Z",
          duration_ms: 1000,
        },
        {
          asset_id: "asset_failure",
          status: "completed",
          exit_code: 1,
          stdout: "",
          stderr: "ffprobe could not read stream",
          started_at: "2026-06-19T19:00:03.500Z",
          ended_at: "2026-06-19T19:00:04.500Z",
          duration_ms: 1000,
        },
      ],
    });

    const result = await runProbePlanWithRunner({
      project,
      plan,
      runner,
      requested_at: "2026-06-19T19:00:03.000Z",
      summary_created_at: "2026-06-19T19:00:05.000Z",
    });

    expectEqual(result.counts.item_count, 4, "runner result should include every plan item");
    expectEqual(result.counts.executed_count, 2, "runner should execute two needs-probe items");
    expectEqual(result.counts.applied_count, 1, "runner should apply one successful probe");
    expectEqual(result.counts.failed_count, 1, "runner should fail one probe");
    expectEqual(result.counts.skipped_count, 2, "runner should skip cache-hit and unsupported items");
    expectEqual(result.counts.cached_count, 1, "runner should cache the successful probe result");

    const events = createProbeProgressEventsFromPlanRunnerResult(result, {
      batch_id: "probe_progress_batch_demo",
      created_at: "2026-06-19T19:00:06.000Z",
    });
    const counts = summarizeProbeProgressEvents(events);

    expectEqual(counts.asset_count, 4, "progress should cover four assets");
    expectEqual(counts.event_count, 11, "progress should create queued/running/terminal events");
    expectEqual(counts.queued_count, 4, "each asset should emit queued progress");
    expectEqual(counts.running_count, 2, "executed assets should emit running progress");
    expectEqual(counts.applied_count, 1, "successful runner item should emit applied progress");
    expectEqual(counts.cached_count, 2, "cache-hit and cache-write should emit cached progress");
    expectEqual(counts.failed_count, 1, "failed runner item should emit failed progress");
    expectEqual(counts.skipped_count, 1, "unsupported asset should emit skipped progress");
    expectEqual(counts.terminal_count, 5, "terminal event count should include applied/cached/failed/skipped events");

    const batch = createProbeProgressBatchFromPlanRunnerResult(result, {
      batch_id: "probe_progress_batch_demo",
      created_at: "2026-06-19T19:00:06.000Z",
    });
    expectEqual(batch.counts.event_count, counts.event_count, "batch should reuse event summary counts");
    expectEqual(batch.plan_id, "probe_progress_plan", "batch should keep plan id");
    expectEqual(batch.runner_id, "mock-progress-runner", "batch should keep runner id");

    const cachedEvent = events.find((event) => event.asset_id === "asset_cached" && event.event_type === "cached");
    if (cachedEvent === undefined) throw new Error("cached event should exist for cache-hit item");
    expectEqual(cachedEvent.reason, "Plan item is cache-hit; runner only executes needs-probe items.", "cache hit reason should be preserved");

    const failedEvent = events.find((event) => event.asset_id === "asset_failure" && event.event_type === "failed");
    if (failedEvent === undefined) throw new Error("failed event should exist");
    expectTrue(failedEvent.request_id !== undefined, "failed event should keep request id");

    const skippedEvent = events.find((event) => event.asset_id === "asset_remote" && event.event_type === "skipped");
    if (skippedEvent === undefined) throw new Error("skipped event should exist for unsupported source");
    expectTrue(isTerminalProbeProgressEvent(skippedEvent.event_type), "skipped should be terminal progress");

    const eventIds = new Set(events.map((event) => event.event_id));
    expectEqual(eventIds.size, events.length, "event ids should be unique for this batch");

    console.log("ParaCut probe progress smoke passed");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

function createProbeProgressProject(
  cachedUri: string,
  successUri: string,
  failureUri: string,
  remoteUri: string,
): ParaCutProject {
  let project = createProject({
    project_id: "proj_probe_progress",
    name: "Probe Progress Smoke",
    created_at: "2026-06-19T19:00:00.000Z",
  });

  project = importMediaToProject(project, {
    asset_id: "asset_cached",
    kind: "video",
    name: "Cached Clip",
    uri: cachedUri,
    imported_at: "2026-06-19T19:00:00.000Z",
  });

  project = importMediaToProject(project, {
    asset_id: "asset_success",
    kind: "video",
    name: "Successful Probe Clip",
    uri: successUri,
    imported_at: "2026-06-19T19:00:00.000Z",
  });

  project = importMediaToProject(project, {
    asset_id: "asset_failure",
    kind: "video",
    name: "Failing Probe Clip",
    uri: failureUri,
    imported_at: "2026-06-19T19:00:00.000Z",
  });

  project = importMediaToProject(project, {
    asset_id: "asset_remote",
    kind: "video",
    name: "Remote Clip",
    uri: remoteUri,
    imported_at: "2026-06-19T19:00:00.000Z",
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
