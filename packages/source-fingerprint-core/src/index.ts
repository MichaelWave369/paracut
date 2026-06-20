import { stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { ProbeCacheKeyInput } from "../../probe-cache-core/src/index";

export const SOURCE_FINGERPRINT_SCHEMA_VERSION = "paracut.source-fingerprint.v0" as const;
export const SOURCE_FINGERPRINT_ALGORITHM = "stat-size-mtime-v0" as const;

export type SourceFingerprintStatus = "fingerprinted" | "missing" | "unsupported";
export type SourceFingerprintScheme = "file" | "relative" | "http" | "https" | "data" | "unknown";

export interface FingerprintSourceInput {
  source_uri: string;
  asset_id?: string;
  project_root_dir?: string;
  fingerprinted_at?: string;
}

export interface CreateSourceFingerprintFromStatsInput {
  source_uri: string;
  resolved_path: string;
  asset_id?: string;
  size_bytes: number;
  mtime_ms: number;
  fingerprinted_at?: string;
}

export interface SourceFingerprint {
  schema_version: typeof SOURCE_FINGERPRINT_SCHEMA_VERSION;
  algorithm: typeof SOURCE_FINGERPRINT_ALGORITHM;
  status: SourceFingerprintStatus;
  source_uri: string;
  normalized_uri: string;
  scheme: SourceFingerprintScheme;
  fingerprinted_at: string;
  asset_id?: string;
  resolved_path?: string;
  fingerprint?: string;
  size_bytes?: number;
  mtime_ms?: number;
  mtime_iso?: string;
  reason?: string;
}

export interface LocalSourceResolution {
  source_uri: string;
  normalized_uri: string;
  scheme: SourceFingerprintScheme;
  is_local: boolean;
  resolved_path?: string;
  reason?: string;
}

export async function fingerprintSource(input: FingerprintSourceInput): Promise<SourceFingerprint> {
  const resolved = resolveSourceForFingerprint(input.source_uri, input.project_root_dir);

  if (!resolved.is_local || !resolved.resolved_path) {
    return createNonFingerprintedResult({
      input,
      resolved,
      status: "unsupported",
      reason: resolved.reason ?? "Only local file and relative media sources can be fingerprinted in v0.12.",
    });
  }

  try {
    const stats = await stat(resolved.resolved_path);
    if (!stats.isFile()) {
      return createNonFingerprintedResult({
        input,
        resolved,
        status: "unsupported",
        reason: "Source exists but is not a regular file.",
      });
    }

    return createSourceFingerprintFromStats({
      source_uri: input.source_uri,
      resolved_path: resolved.resolved_path,
      size_bytes: stats.size,
      mtime_ms: stats.mtimeMs,
      ...(input.asset_id !== undefined ? { asset_id: input.asset_id } : {}),
      ...(input.fingerprinted_at !== undefined ? { fingerprinted_at: input.fingerprinted_at } : {}),
    });
  } catch (error) {
    if (isMissingFileError(error)) {
      return createNonFingerprintedResult({
        input,
        resolved,
        status: "missing",
        reason: "Source file does not exist at the resolved local path.",
      });
    }
    throw error;
  }
}

export function createSourceFingerprintFromStats(input: CreateSourceFingerprintFromStatsInput): SourceFingerprint {
  if (!input.source_uri.trim()) throw new Error("Source fingerprint requires source_uri");
  if (!input.resolved_path.trim()) throw new Error("Source fingerprint requires resolved_path");
  if (!Number.isFinite(input.size_bytes) || input.size_bytes < 0) {
    throw new Error("Source fingerprint size_bytes must be a non-negative finite number");
  }
  if (!Number.isFinite(input.mtime_ms) || input.mtime_ms < 0) {
    throw new Error("Source fingerprint mtime_ms must be a non-negative finite number");
  }

  const sizeBytes = Math.trunc(input.size_bytes);
  const mtimeMs = Math.trunc(input.mtime_ms);
  const normalizedUri = normalizeLocalSourceUri(input.source_uri, input.resolved_path);

  const result: SourceFingerprint = {
    schema_version: SOURCE_FINGERPRINT_SCHEMA_VERSION,
    algorithm: SOURCE_FINGERPRINT_ALGORITHM,
    status: "fingerprinted",
    source_uri: input.source_uri,
    normalized_uri: normalizedUri,
    scheme: detectSourceFingerprintScheme(input.source_uri),
    resolved_path: resolve(input.resolved_path),
    fingerprint: buildStatFingerprint({ size_bytes: sizeBytes, mtime_ms: mtimeMs }),
    size_bytes: sizeBytes,
    mtime_ms: mtimeMs,
    mtime_iso: new Date(mtimeMs).toISOString(),
    fingerprinted_at: input.fingerprinted_at ?? new Date().toISOString(),
  };

  if (input.asset_id !== undefined) result.asset_id = input.asset_id;

  return result;
}

export function sourceFingerprintToProbeCacheInput(
  fingerprint: SourceFingerprint,
  assetId?: string,
): ProbeCacheKeyInput {
  if (fingerprint.status !== "fingerprinted" || !fingerprint.fingerprint) {
    throw new Error("Probe cache lookup requires a successful source fingerprint");
  }

  const resolvedAssetId = assetId ?? fingerprint.asset_id;
  if (!resolvedAssetId) throw new Error("Probe cache lookup requires asset_id");

  return {
    asset_id: resolvedAssetId,
    source_uri: fingerprint.source_uri,
    source_fingerprint: fingerprint.fingerprint,
  };
}

export function buildStatFingerprint(input: { size_bytes: number; mtime_ms: number }): string {
  const sizeBytes = Math.trunc(input.size_bytes);
  const mtimeMs = Math.trunc(input.mtime_ms);
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) {
    throw new Error("Stat fingerprint size_bytes must be a non-negative finite number");
  }
  if (!Number.isFinite(mtimeMs) || mtimeMs < 0) {
    throw new Error("Stat fingerprint mtime_ms must be a non-negative finite number");
  }
  return `${SOURCE_FINGERPRINT_ALGORITHM}:size=${sizeBytes};mtimeMs=${mtimeMs}`;
}

export function resolveSourceForFingerprint(sourceUri: string, projectRootDir?: string): LocalSourceResolution {
  const source = sourceUri.trim();
  if (!source) throw new Error("Source fingerprint requires source_uri");

  const scheme = detectSourceFingerprintScheme(source);

  if (scheme === "http" || scheme === "https" || scheme === "data" || scheme === "unknown") {
    return {
      source_uri: source,
      normalized_uri: source,
      scheme,
      is_local: false,
      reason: `Scheme ${scheme} cannot be fingerprinted from local filesystem stats.`,
    };
  }

  if (source.toLowerCase().startsWith("file://")) {
    const resolvedPath = fileURLToPath(source);
    return {
      source_uri: source,
      normalized_uri: pathToFileURL(resolvedPath).href,
      scheme: "file",
      is_local: true,
      resolved_path: resolvedPath,
    };
  }

  const baseDir = projectRootDir !== undefined ? projectRootDir : process.cwd();
  const resolvedPath = isAbsolute(source) ? source : resolve(baseDir, source);
  return {
    source_uri: source,
    normalized_uri: isAbsolute(source) ? pathToFileURL(resolvedPath).href : source,
    scheme: isAbsolute(source) ? "file" : "relative",
    is_local: true,
    resolved_path: resolvedPath,
  };
}

export function detectSourceFingerprintScheme(sourceUri: string): SourceFingerprintScheme {
  const source = sourceUri.trim().toLowerCase();
  if (source.startsWith("file://")) return "file";
  if (source.startsWith("https://")) return "https";
  if (source.startsWith("http://")) return "http";
  if (source.startsWith("data:")) return "data";
  if (source.includes("://")) return "unknown";
  return isAbsolute(sourceUri.trim()) ? "file" : "relative";
}

function createNonFingerprintedResult(input: {
  input: FingerprintSourceInput;
  resolved: LocalSourceResolution;
  status: Exclude<SourceFingerprintStatus, "fingerprinted">;
  reason: string;
}): SourceFingerprint {
  const result: SourceFingerprint = {
    schema_version: SOURCE_FINGERPRINT_SCHEMA_VERSION,
    algorithm: SOURCE_FINGERPRINT_ALGORITHM,
    status: input.status,
    source_uri: input.input.source_uri,
    normalized_uri: input.resolved.normalized_uri,
    scheme: input.resolved.scheme,
    reason: input.reason,
    fingerprinted_at: input.input.fingerprinted_at ?? new Date().toISOString(),
  };

  if (input.input.asset_id !== undefined) result.asset_id = input.input.asset_id;
  if (input.resolved.resolved_path !== undefined) result.resolved_path = input.resolved.resolved_path;

  return result;
}

function normalizeLocalSourceUri(sourceUri: string, resolvedPath: string): string {
  if (sourceUri.trim().toLowerCase().startsWith("file://")) {
    return pathToFileURL(fileURLToPath(sourceUri)).href;
  }
  const scheme = detectSourceFingerprintScheme(sourceUri);
  if (scheme === "relative") return sourceUri.trim();
  return pathToFileURL(resolve(resolvedPath)).href;
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "ENOENT";
}
