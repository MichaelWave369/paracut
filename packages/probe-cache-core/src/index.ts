import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { MediaProbeResult, MediaProbeSource, MediaProbeStatus } from "../../media-probe-core/src/index";

export const PROBE_CACHE_SCHEMA_VERSION = "paracut.probe-cache.v0" as const;
export const PARACUT_INTERNAL_FOLDER_NAME = ".paracut" as const;
export const PROBE_CACHE_FOLDER_NAME = "probes" as const;
export const PROBE_CACHE_FILE_EXTENSION = ".json" as const;

export interface ProbeCacheKeyInput {
  asset_id: string;
  source_uri: string;
  source_fingerprint?: string;
}

export interface CreateProbeCacheRecordInput {
  result: MediaProbeResult;
  source_fingerprint?: string;
  cache_key?: string;
  cached_at?: string;
}

export interface ProbeCachePaths {
  project_root_dir: string;
  paracut_dir: string;
  probe_cache_dir: string;
}

export interface ProbeCacheRecord {
  schema_version: typeof PROBE_CACHE_SCHEMA_VERSION;
  cache_key: string;
  asset_id: string;
  source_uri: string;
  source_fingerprint?: string;
  cached_at: string;
  probe: MediaProbeResult;
}

export interface ProbeCacheWriteResult {
  paths: ProbeCachePaths;
  record: ProbeCacheRecord;
  cache_path: string;
}

export function getProbeCachePaths(projectRootDir: string): ProbeCachePaths {
  const projectRoot = resolve(projectRootDir);
  const paracutDir = join(projectRoot, PARACUT_INTERNAL_FOLDER_NAME);
  return {
    project_root_dir: projectRoot,
    paracut_dir: paracutDir,
    probe_cache_dir: join(paracutDir, PROBE_CACHE_FOLDER_NAME),
  };
}

export function getProbeCachePath(projectRootDir: string, cacheKey: string): string {
  if (!cacheKey) throw new Error("Probe cache path requires cacheKey");
  const paths = getProbeCachePaths(projectRootDir);
  return join(paths.probe_cache_dir, `${safeCacheSegment(cacheKey)}${PROBE_CACHE_FILE_EXTENSION}`);
}

export function createProbeCacheKey(input: ProbeCacheKeyInput): string {
  if (!input.asset_id) throw new Error("Probe cache key requires asset_id");
  if (!input.source_uri) throw new Error("Probe cache key requires source_uri");

  const fingerprint = input.source_fingerprint ?? "unknown-fingerprint";
  const hash = stableHash(`${input.asset_id}\n${input.source_uri}\n${fingerprint}`);
  return `${safeCacheSegment(input.asset_id)}_${hash}`;
}

export function createProbeCacheRecord(input: CreateProbeCacheRecordInput): ProbeCacheRecord {
  const result = input.result;
  assertMediaProbeResult(result);

  const cacheKey = input.cache_key ?? createProbeCacheKey({
    asset_id: result.asset_id,
    source_uri: result.source_uri,
    ...(input.source_fingerprint !== undefined ? { source_fingerprint: input.source_fingerprint } : {}),
  });

  const record: ProbeCacheRecord = {
    schema_version: PROBE_CACHE_SCHEMA_VERSION,
    cache_key: cacheKey,
    asset_id: result.asset_id,
    source_uri: result.source_uri,
    cached_at: input.cached_at ?? new Date().toISOString(),
    probe: result,
  };

  if (input.source_fingerprint !== undefined) {
    record.source_fingerprint = input.source_fingerprint;
  }

  return record;
}

export function serializeProbeCacheRecord(record: ProbeCacheRecord): string {
  assertProbeCacheRecord(record);
  return `${JSON.stringify(record, null, 2)}\n`;
}

export function parseProbeCacheRecord(json: string): ProbeCacheRecord {
  const parsed = JSON.parse(json) as unknown;
  assertProbeCacheRecord(parsed);
  return parsed;
}

export async function saveProbeCacheRecord(
  projectRootDir: string,
  record: ProbeCacheRecord,
): Promise<ProbeCacheWriteResult> {
  assertProbeCacheRecord(record);
  const paths = getProbeCachePaths(projectRootDir);
  const cachePath = getProbeCachePath(projectRootDir, record.cache_key);

  await mkdir(paths.probe_cache_dir, { recursive: true });
  await writeFile(cachePath, serializeProbeCacheRecord(record), "utf8");

  return {
    paths,
    record,
    cache_path: cachePath,
  };
}

export async function saveProbeResultToCache(
  projectRootDir: string,
  input: CreateProbeCacheRecordInput,
): Promise<ProbeCacheWriteResult> {
  return saveProbeCacheRecord(projectRootDir, createProbeCacheRecord(input));
}

export async function loadProbeCacheRecord(
  projectRootDir: string,
  cacheKey: string,
): Promise<ProbeCacheRecord> {
  const cachePath = getProbeCachePath(projectRootDir, cacheKey);
  return parseProbeCacheRecord(await readFile(cachePath, "utf8"));
}

export async function loadProbeResultFromCache(
  projectRootDir: string,
  input: ProbeCacheKeyInput,
): Promise<MediaProbeResult | undefined> {
  const cacheKey = createProbeCacheKey(input);
  try {
    const record = await loadProbeCacheRecord(projectRootDir, cacheKey);
    assertCacheRecordMatchesInput(record, input);
    return record.probe;
  } catch (error) {
    if (isMissingFileError(error)) return undefined;
    throw error;
  }
}

export function assertProbeCacheRecord(value: unknown): asserts value is ProbeCacheRecord {
  const candidate = value as Partial<ProbeCacheRecord>;
  if (candidate.schema_version !== PROBE_CACHE_SCHEMA_VERSION) {
    throw new Error("Unsupported probe cache schema version");
  }
  if (!candidate.cache_key) throw new Error("Probe cache record missing cache_key");
  if (!candidate.asset_id) throw new Error("Probe cache record missing asset_id");
  if (!candidate.source_uri) throw new Error("Probe cache record missing source_uri");
  if (!candidate.cached_at) throw new Error("Probe cache record missing cached_at");
  assertMediaProbeResult(candidate.probe);
  if (candidate.probe.asset_id !== candidate.asset_id) {
    throw new Error("Probe cache asset_id does not match probe asset_id");
  }
  if (candidate.probe.source_uri !== candidate.source_uri) {
    throw new Error("Probe cache source_uri does not match probe source_uri");
  }
}

export function assertCacheRecordMatchesInput(record: ProbeCacheRecord, input: ProbeCacheKeyInput): void {
  if (record.asset_id !== input.asset_id) {
    throw new Error("Probe cache record asset_id does not match lookup input");
  }
  if (record.source_uri !== input.source_uri) {
    throw new Error("Probe cache record source_uri does not match lookup input");
  }
  if (input.source_fingerprint !== undefined && record.source_fingerprint !== input.source_fingerprint) {
    throw new Error("Probe cache record fingerprint does not match lookup input");
  }
}

function assertMediaProbeResult(value: unknown): asserts value is MediaProbeResult {
  const candidate = value as Partial<MediaProbeResult>;
  if (!candidate) throw new Error("Probe cache record missing probe");
  if (!candidate.probe_id) throw new Error("Probe result missing probe_id");
  if (!candidate.asset_id) throw new Error("Probe result missing asset_id");
  if (!candidate.source_uri) throw new Error("Probe result missing source_uri");
  if (!isProbeSource(candidate.source)) throw new Error("Probe result source is invalid");
  if (!isProbeStatus(candidate.status)) throw new Error("Probe result status is invalid");
  if (!candidate.probed_at) throw new Error("Probe result missing probed_at");
  if (!Array.isArray(candidate.warnings)) throw new Error("Probe result warnings must be an array");
  if (!Array.isArray(candidate.errors)) throw new Error("Probe result errors must be an array");
  if (candidate.metadata !== undefined && !Array.isArray(candidate.metadata.streams)) {
    throw new Error("Probe result metadata streams must be an array");
  }
}

function isProbeSource(value: unknown): value is MediaProbeSource {
  return value === "manual" || value === "mock" || value === "ffprobe" || value === "sidecar";
}

function isProbeStatus(value: unknown): value is MediaProbeStatus {
  return value === "probed" || value === "failed" || value === "skipped";
}

function safeCacheSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "cache";
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT";
}
