import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import {
  createProbeProgressBatch,
  createProbeProgressEvent,
} from "../packages/probe-progress-core/src/index";
import {
  getLatestProbeProgressPath,
  getProbeProgressPath,
  getProbeProgressPersistencePaths,
  loadLatestProbeProgressBatch,
  loadLatestProbeProgressRecord,
  loadProbeProgressBatch,
  loadProbeProgressRecord,
  saveProbeProgressBatch,
} from "../packages/probe-progress-persistence-core/src/index";

async function main(): Promise<void> {
  const rootDir = await mkdtemp(join(tmpdir(), "paracut-probe-progress-persistence-"));

  try {
    const batch = createProbeProgressBatch({
      batch_id: "progress persistence demo/batch:01",
      project_id: "proj_progress_persistence",
      plan_id: "probe_plan_progress_persistence",
      runner_id: "mock-progress-persistence-runner",
      created_at: "2026-06-19T20:00:00.000Z",
      updated_at: "2026-06-19T20:00:04.000Z",
      events: [
        createProbeProgressEvent({
          batch_id: "progress persistence demo/batch:01",
          project_id: "proj_progress_persistence",
          plan_id: "probe_plan_progress_persistence",
          runner_id: "mock-progress-persistence-runner",
          asset_id: "asset_progress_persisted",
          source_uri: "persisted-progress.mp4",
          event_type: "queued",
          message: "Probe work queued for asset_progress_persisted.",
          created_at: "2026-06-19T20:00:00.000Z",
        }),
        createProbeProgressEvent({
          batch_id: "progress persistence demo/batch:01",
          project_id: "proj_progress_persistence",
          plan_id: "probe_plan_progress_persistence",
          runner_id: "mock-progress-persistence-runner",
          asset_id: "asset_progress_persisted",
          source_uri: "persisted-progress.mp4",
          request_id: "probe_request_progress_persisted",
          event_type: "running",
          message: "Probe runner started for asset_progress_persisted.",
          created_at: "2026-06-19T20:00:01.000Z",
        }),
        createProbeProgressEvent({
          batch_id: "progress persistence demo/batch:01",
          project_id: "proj_progress_persistence",
          plan_id: "probe_plan_progress_persistence",
          runner_id: "mock-progress-persistence-runner",
          asset_id: "asset_progress_persisted",
          source_uri: "persisted-progress.mp4",
          request_id: "probe_request_progress_persisted",
          event_type: "applied",
          message: "Probe metadata applied for asset_progress_persisted.",
          created_at: "2026-06-19T20:00:03.000Z",
        }),
        createProbeProgressEvent({
          batch_id: "progress persistence demo/batch:01",
          project_id: "proj_progress_persistence",
          plan_id: "probe_plan_progress_persistence",
          runner_id: "mock-progress-persistence-runner",
          asset_id: "asset_progress_persisted",
          source_uri: "persisted-progress.mp4",
          request_id: "probe_request_progress_persisted",
          event_type: "cached",
          message: "Probe metadata cached for asset_progress_persisted.",
          reason: "probe-cache-key-demo",
          created_at: "2026-06-19T20:00:04.000Z",
        }),
      ],
    });

    const write = await saveProbeProgressBatch(rootDir, batch, {
      saved_at: "2026-06-19T20:00:05.000Z",
    });

    const paths = getProbeProgressPersistencePaths(rootDir);
    expectEqual(write.paths.progress_dir, paths.progress_dir, "write should report progress dir");
    expectEqual(write.record.saved_at, "2026-06-19T20:00:05.000Z", "save time should be preserved");
    expectEqual(basename(write.progress_path), "progress-persistence-demo-batch-01.json", "batch filename should be safe");
    expectEqual(write.latest_path, getLatestProbeProgressPath(rootDir), "latest path should be reported by default");
    expectEqual(write.progress_path, getProbeProgressPath(rootDir, batch.batch_id), "batch path helper should match write result");

    const loadedRecord = await loadProbeProgressRecord(rootDir, batch.batch_id);
    expectEqual(loadedRecord.batch_id, batch.batch_id, "loaded record should preserve batch id");
    expectEqual(loadedRecord.project_id, batch.project_id, "loaded record should preserve project id");
    expectEqual(loadedRecord.progress.counts.cached_count, 1, "loaded record should preserve cached count");

    const loadedBatch = await loadProbeProgressBatch(rootDir, batch.batch_id);
    expectEqual(loadedBatch.events.length, 4, "loaded batch should preserve events");
    expectEqual(loadedBatch.counts.queued_count, 1, "loaded batch should preserve queued count");
    expectEqual(loadedBatch.counts.running_count, 1, "loaded batch should preserve running count");
    expectEqual(loadedBatch.counts.applied_count, 1, "loaded batch should preserve applied count");
    expectEqual(loadedBatch.counts.cached_count, 1, "loaded batch should preserve cached count");

    const latestRecord = await loadLatestProbeProgressRecord(rootDir);
    expectEqual(latestRecord.batch_id, batch.batch_id, "latest record should point to saved batch");

    const latestBatch = await loadLatestProbeProgressBatch(rootDir);
    expectEqual(latestBatch.batch_id, batch.batch_id, "latest batch should load saved batch");
    expectEqual(latestBatch.counts.terminal_count, 2, "latest batch should preserve terminal count");

    console.log("ParaCut probe progress persistence smoke passed");
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
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
