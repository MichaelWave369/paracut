import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
  PROBE_PROGRESS_SCHEMA_VERSION,
  summarizeProbeProgressEvents,
  type ProbeProgressBatch,
  type ProbeProgressEvent,
  type ProbeProgressEventType,
} from "../../probe-progress-core/src/index";

export const PROBE_PROGRESS_PERSISTENCE_SCHEMA_VERSION = "paracut.probe-progress-persistence.v0" as const;
export const PARACUT_INTERNAL_FOLDER_NAME = ".paracut" as const;
export const PROBE_PROGRESS_FOLDER_NAME = "progress" as const;
export const PROBE_PROGRESS_FILE_EXTENSION = ".json" as const;
export const LATEST_PROBE_PROGRESS_FILE_NAME = "latest.json" as const;

export interface ProbeProgressPersistencePaths {
  project_root_dir: string;
  paracut_dir: string;
  progress_dir: string;
}

export interface ProbeProgressPersistenceRecord {
  schema_version: typeof PROBE_PROGRESS_PERSISTENCE_SCHEMA_VERSION;
  batch_id: string;
  project_id: string;
  saved_at: string;
  progress: ProbeProgressBatch;
}

export interface SaveProbeProgressBatchOptions {
  saved_at?: string | undefined;
  write_latest?: boolean | undefined;
}

export interface ProbeProgressPersistenceWriteResult {
  paths: ProbeProgressPersistencePaths;
  record: ProbeProgressPersistenceRecord;
  progress_path: string;
  latest_path?: string;
}

export function getProbeProgressPersistencePaths(projectRootDir: string): ProbeProgressPersistencePaths {
  const projectRoot = resolve(projectRootDir);
  const paracutDir = join(projectRoot, PARACUT_INTERNAL_FOLDER_NAME);
  return {
    project_root_dir: projectRoot,
    paracut_dir: paracutDir,
    progress_dir: join(paracutDir, PROBE_PROGRESS_FOLDER_NAME),
  };
}

export function getProbeProgressPath(projectRootDir: string, batchId: string): string {
  if (batchId.trim().length === 0) throw new Error("Probe progress path requires batchId");
  const paths = getProbeProgressPersistencePaths(projectRootDir);
  return join(paths.progress_dir, `${safeProgressSegment(batchId)}${PROBE_PROGRESS_FILE_EXTENSION}`);
}

export function getLatestProbeProgressPath(projectRootDir: string): string {
  const paths = getProbeProgressPersistencePaths(projectRootDir);
  return join(paths.progress_dir, LATEST_PROBE_PROGRESS_FILE_NAME);
}

export function createProbeProgressPersistenceRecord(
  batch: ProbeProgressBatch,
  options: SaveProbeProgressBatchOptions = {},
): ProbeProgressPersistenceRecord {
  assertProbeProgressBatch(batch);
  return {
    schema_version: PROBE_PROGRESS_PERSISTENCE_SCHEMA_VERSION,
    batch_id: batch.batch_id,
    project_id: batch.project_id,
    saved_at: options.saved_at ?? new Date().toISOString(),
    progress: batch,
  };
}

export function serializeProbeProgressPersistenceRecord(record: ProbeProgressPersistenceRecord): string {
  assertProbeProgressPersistenceRecord(record);
  return `${JSON.stringify(record, null, 2)}\n`;
}

export function parseProbeProgressPersistenceRecord(json: string): ProbeProgressPersistenceRecord {
  const parsed = JSON.parse(json) as unknown;
  assertProbeProgressPersistenceRecord(parsed);
  return parsed;
}

export async function saveProbeProgressBatch(
  projectRootDir: string,
  batch: ProbeProgressBatch,
  options: SaveProbeProgressBatchOptions = {},
): Promise<ProbeProgressPersistenceWriteResult> {
  const record = createProbeProgressPersistenceRecord(batch, options);
  const paths = getProbeProgressPersistencePaths(projectRootDir);
  const progressPath = getProbeProgressPath(projectRootDir, batch.batch_id);
  const writeLatest = options.write_latest ?? true;

  await mkdir(paths.progress_dir, { recursive: true });
  await writeFile(progressPath, serializeProbeProgressPersistenceRecord(record), "utf8");

  const result: ProbeProgressPersistenceWriteResult = {
    paths,
    record,
    progress_path: progressPath,
  };

  if (writeLatest) {
    const latestPath = getLatestProbeProgressPath(projectRootDir);
    await writeFile(latestPath, serializeProbeProgressPersistenceRecord(record), "utf8");
    result.latest_path = latestPath;
  }

  return result;
}

export async function loadProbeProgressRecord(
  projectRootDir: string,
  batchId: string,
): Promise<ProbeProgressPersistenceRecord> {
  const progressPath = getProbeProgressPath(projectRootDir, batchId);
  return parseProbeProgressPersistenceRecord(await readFile(progressPath, "utf8"));
}

export async function loadProbeProgressBatch(projectRootDir: string, batchId: string): Promise<ProbeProgressBatch> {
  return (await loadProbeProgressRecord(projectRootDir, batchId)).progress;
}

export async function loadLatestProbeProgressRecord(projectRootDir: string): Promise<ProbeProgressPersistenceRecord> {
  const latestPath = getLatestProbeProgressPath(projectRootDir);
  return parseProbeProgressPersistenceRecord(await readFile(latestPath, "utf8"));
}

export async function loadLatestProbeProgressBatch(projectRootDir: string): Promise<ProbeProgressBatch> {
  return (await loadLatestProbeProgressRecord(projectRootDir)).progress;
}

export function assertProbeProgressPersistenceRecord(value: unknown): asserts value is ProbeProgressPersistenceRecord {
  const candidate = value as Partial<ProbeProgressPersistenceRecord>;
  if (candidate.schema_version !== PROBE_PROGRESS_PERSISTENCE_SCHEMA_VERSION) {
    throw new Error("Unsupported probe progress persistence schema version");
  }
  if (!candidate.batch_id) throw new Error("Probe progress persistence record missing batch_id");
  if (!candidate.project_id) throw new Error("Probe progress persistence record missing project_id");
  if (!candidate.saved_at) throw new Error("Probe progress persistence record missing saved_at");
  assertProbeProgressBatch(candidate.progress);
  if (candidate.progress.batch_id !== candidate.batch_id) {
    throw new Error("Probe progress persistence batch_id does not match progress batch_id");
  }
  if (candidate.progress.project_id !== candidate.project_id) {
    throw new Error("Probe progress persistence project_id does not match progress project_id");
  }
}

export function assertProbeProgressBatch(value: unknown): asserts value is ProbeProgressBatch {
  const candidate = value as Partial<ProbeProgressBatch>;
  if (candidate.schema_version !== PROBE_PROGRESS_SCHEMA_VERSION) {
    throw new Error("Unsupported probe progress schema version");
  }
  if (!candidate.batch_id) throw new Error("Probe progress batch missing batch_id");
  if (!candidate.project_id) throw new Error("Probe progress batch missing project_id");
  if (!candidate.created_at) throw new Error("Probe progress batch missing created_at");
  if (!candidate.updated_at) throw new Error("Probe progress batch missing updated_at");
  if (!Array.isArray(candidate.events)) throw new Error("Probe progress batch events must be an array");
  for (const event of candidate.events) assertProbeProgressEvent(event);
  const expectedCounts = summarizeProbeProgressEvents(candidate.events);
  if (candidate.counts === undefined) throw new Error("Probe progress batch missing counts");
  if (candidate.counts.event_count !== expectedCounts.event_count) throw new Error("Probe progress batch event_count mismatch");
  if (candidate.counts.asset_count !== expectedCounts.asset_count) throw new Error("Probe progress batch asset_count mismatch");
  if (candidate.counts.queued_count !== expectedCounts.queued_count) throw new Error("Probe progress batch queued_count mismatch");
  if (candidate.counts.running_count !== expectedCounts.running_count) throw new Error("Probe progress batch running_count mismatch");
  if (candidate.counts.applied_count !== expectedCounts.applied_count) throw new Error("Probe progress batch applied_count mismatch");
  if (candidate.counts.cached_count !== expectedCounts.cached_count) throw new Error("Probe progress batch cached_count mismatch");
  if (candidate.counts.failed_count !== expectedCounts.failed_count) throw new Error("Probe progress batch failed_count mismatch");
  if (candidate.counts.skipped_count !== expectedCounts.skipped_count) throw new Error("Probe progress batch skipped_count mismatch");
  if (candidate.counts.terminal_count !== expectedCounts.terminal_count) {
    throw new Error("Probe progress batch terminal_count mismatch");
  }
}

export function assertProbeProgressEvent(value: unknown): asserts value is ProbeProgressEvent {
  const candidate = value as Partial<ProbeProgressEvent>;
  if (candidate.schema_version !== PROBE_PROGRESS_SCHEMA_VERSION) {
    throw new Error("Unsupported probe progress event schema version");
  }
  if (!candidate.event_id) throw new Error("Probe progress event missing event_id");
  if (!candidate.batch_id) throw new Error("Probe progress event missing batch_id");
  if (!candidate.project_id) throw new Error("Probe progress event missing project_id");
  if (!isProgressEventType(candidate.event_type)) throw new Error("Probe progress event_type is invalid");
  if (!candidate.message) throw new Error("Probe progress event missing message");
  if (!candidate.created_at) throw new Error("Probe progress event missing created_at");
}

function isProgressEventType(value: unknown): value is ProbeProgressEventType {
  return value === "queued"
    || value === "running"
    || value === "applied"
    || value === "cached"
    || value === "failed"
    || value === "skipped";
}

function safeProgressSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "progress";
}
