import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMediaProbeResult } from "../packages/media-probe-core/src/index";
import { saveProbeResultToCache } from "../packages/probe-cache-core/src/index";
import { planMediaProbesForProject } from "../packages/probe-planning-core/src/index";
import { runProbePlanWithRunner } from "../packages/probe-plan-runner-core/src/index";
import type { ProbeProgressEvent, ProbeProgressEventType } from "../packages/probe-progress-core/src/index";
import { createMockProbeRunner } from "../packages/probe-runner-core/src/index";
import { fingerprintSource } from "../packages/source-fingerprint-core/src/index";
import {
  createProject,
  getProjectMedia,
  importMediaToProject,
  type ParaCutProject,
} from "../packages/project-core/src/index";

async function main(): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "paracut-probe-runner-progress-"));

  try {
    const cachedUri = "cached-progress.mp4";
    const needsProbeUri = "needs-progress-probe.mp4";
    await writeFile(join(rootDir, cachedUri), "cached progress media bytes", "utf8");
    await writeFile(join(rootDir, needsProbeUri), "needs progress probe bytes", "utf8");

    let project = createProgressBridgeProject(cachedUri, needsProbeUri);

    const cachedFingerprint = await fingerprintSource({
      asset_id: "asset_progress_cached",
      source_uri: cachedUri,
      project_root_dir: rootDir,
      fingerprinted_at: "2026-06-19T19:00:00.000Z",
    });
    expectEqual(cachedFingerprint.status, "fingerprinted", "cached progress asset should fingerprint");
    if (cachedFingerprint.status !== "fingerprinted") throw new Error("Expected cached progress fingerprint");
    const cachedSourceFingerprint = cachedFingerprint.fingerprint;
    if (cachedSourceFingerprint === undefined) throw new Error("Expected cached progress fingerprint value");

    const cachedProbe = createMediaProbeResult({
      asset_id: "asset_progress_cached",
      source_uri: cachedUri,
      project_id: project.project_id,
      probe_id: "probe_progress_cached_existing",
      source: "ffprobe",
      status: "probed",
      probed_at: "2026-06-19T19:00:01.000Z",
      container: { duration_seconds: 8, format_name: "mov,mp4,m4a,3gp,3g2,mj2" },
      video: { codec: "h264", width: 854, height: 480, fps: 30 },
      audio: { codec: "aac", sample_rate: 48000, channels: 2 },
    });
    await saveProbeResultToCache(rootDir, {
      result: cachedProbe,
      source_fingerprint: cachedSourceFingerprint,
    });

    const plan = await planMediaProbesForProject(project, {
      project_root_dir: rootDir,
      plan_id: "probe_runner_progress_bridge_demo",
      planned_at: "2026-06-19T19:00:02.000Z",
    });
    expectEqual(plan.counts.cache_hit_count, 1, "plan should contain one cache-hit progress item");
    expectEqual(plan.counts.needs_probe_count, 1, "plan should contain one needs-probe progress item");

    const runner = createMockProbeRunner({
      runner_id: "mock-progress-bridge-runner",
      fixtures: [
        {
          asset_id: "asset_progress_needs_probe",
          status: "completed",
          exit_code: 0,
          stdout: JSON.stringify(createFfprobePayload()),
          stderr: "",
          started_at: "2026-06-19T19:00:03.000Z",
          ended_at: "2026-06-19T19:00:04.000Z",
          duration_ms: 1000,
        },
      ],
    });

    const callbackEvents: ProbeProgressEvent[] = [];
    const result = await runProbePlanWithRunner({
      project,
      plan,
      runner,
      requested_at: "2026-06-19T19:00:03.000Z",
      summary_created_at: "2026-06-19T19:00:05.000Z",
      include_progress_batch: true,
      progress_batch_id: "progress_bridge_batch_demo",
      progress_created_at: "2026-06-19T19:00:02.500Z",
      on_progress_event: (event) => {
        callbackEvents.push(event);
      },
    });
    project = result.project;

    if (result.progress_batch === undefined) throw new Error("progress batch should be returned when requested");
    expectEqual(result.progress_batch.batch_id, "progress_bridge_batch_demo", "progress batch id should be caller-controlled");
    expectEqual(result.progress_batch.counts.queued_count, 2, "progress should queue both assets");
    expectEqual(result.progress_batch.counts.running_count, 1, "progress should run only needs-probe item");
    expectEqual(result.progress_batch.counts.applied_count, 1, "progress should apply one probe result");
    expectEqual(result.progress_batch.counts.cached_count, 2, "progress should include existing cache hit and new cache write");
    expectEqual(result.progress_batch.counts.failed_count, 0, "progress should not fail this run");
    expectEqual(result.progress_batch.counts.skipped_count, 0, "cache-hit should surface as cached, not skipped");
    expectEqual(callbackEvents.length, result.progress_batch.events.length, "callback should receive every collected progress event");

    const eventTypes = result.progress_batch.events.map((event) => event.event_type);
    expectArrayEqual(eventTypes, ["queued", "cached", "queued", "running", "applied", "cached"], "progress event order should follow runner flow");
    expectArrayEqual(callbackEvents.map((event) => event.event_type), eventTypes, "callback event order should match collected batch");

    const runningEvent = result.progress_batch.events.find((event) => event.event_type === "running");
    if (runningEvent === undefined) throw new Error("running progress event should exist");
    expectEqual(runningEvent.asset_id, "asset_progress_needs_probe", "running event should be for needs-probe asset");
    expectTrue(runningEvent.request_id !== undefined, "running event should include request id");

    const enrichedAsset = getProjectMedia(project, "asset_progress_needs_probe");
    if (enrichedAsset === undefined) throw new Error("progress enriched asset should exist");
    expectEqual(enrichedAsset.duration_seconds, 21.25, "progress bridge should still apply probe metadata");

    console.log("ParaCut probe runner progress bridge smoke passed");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

function createProgressBridgeProject(cachedUri: string, needsProbeUri: string): ParaCutProject {
  let project = createProject({
    project_id: "proj_probe_runner_progress_bridge",
    name: "Probe Runner Progress Bridge Smoke",
    created_at: "2026-06-19T19:00:00.000Z",
  });

  project = importMediaToProject(project, {
    asset_id: "asset_progress_cached",
    kind: "video",
    name: "Progress Cached Clip",
    uri: cachedUri,
    imported_at: "2026-06-19T19:00:00.000Z",
  });

  project = importMediaToProject(project, {
    asset_id: "asset_progress_needs_probe",
    kind: "video",
    name: "Progress Needs Probe Clip",
    uri: needsProbeUri,
    imported_at: "2026-06-19T19:00:00.000Z",
  });

  return project;
}

function createFfprobePayload(): Record<string, unknown> {
  return {
    format: {
      format_name: "mov,mp4,m4a,3gp,3g2,mj2",
      duration: "21.25",
      bit_rate: "8000000",
      size: "21250000",
    },
    streams: [
      {
        index: 0,
        codec_type: "video",
        codec_name: "h264",
        width: 1920,
        height: 1080,
        avg_frame_rate: "24000/1001",
        duration: "21.25",
        bit_rate: "7600000",
      },
      {
        index: 1,
        codec_type: "audio",
        codec_name: "aac",
        sample_rate: "48000",
        channels: 2,
        duration: "21.25",
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

function expectArrayEqual<T>(actual: T[], expected: T[], message: string): void {
  if (actual.length !== expected.length) {
    throw new Error(`${message}: expected length ${expected.length}, received ${actual.length}`);
  }
  for (let index = 0; index < actual.length; index += 1) {
    if (actual[index] !== expected[index]) {
      throw new Error(`${message}: expected ${String(expected[index])} at ${index}, received ${String(actual[index])}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
