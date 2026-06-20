import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createMediaProbeForAsset } from "../packages/media-probe-core/src/index";
import {
  createProbeCacheKey,
  getProbeCachePath,
  loadProbeCacheRecord,
  loadProbeResultFromCache,
  parseProbeCacheRecord,
  PROBE_CACHE_SCHEMA_VERSION,
  saveProbeResultToCache,
} from "../packages/probe-cache-core/src/index";
import { createProject, importMediaToProject } from "../packages/project-core/src/index";

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const rootDir = await mkdtemp(join(tmpdir(), "paracut-probe-cache-"));

try {
  let project = createProject({
    project_id: "probe-cache-smoke",
    name: "Probe Cache Smoke",
    created_at: "2026-06-19T00:00:00.000Z",
  });

  project = importMediaToProject(project, {
    asset_id: "hero-video",
    kind: "video",
    name: "Hero Video",
    uri: "file:///media/hero-video.mp4",
  });

  const asset = project.media.assets.find((candidate) => candidate.asset_id === "hero-video");
  if (!asset) throw new Error("Expected imported asset for probe cache smoke test");

  const sourceFingerprint = "size=2048;mtime=2026-06-19T00:00:00.000Z";
  const probe = createMediaProbeForAsset(asset, {
    project_id: project.project_id,
    source: "mock",
    probed_at: "2026-06-19T00:01:00.000Z",
    container: {
      format_name: "mov,mp4,m4a,3gp,3g2,mj2",
      duration_seconds: 12.5,
      bitrate: 4_000_000,
      size_bytes: 2_048,
    },
    video: {
      codec: "h264",
      width: 1920,
      height: 1080,
      fps: 29.97,
      bitrate: 3_500_000,
    },
    audio: {
      codec: "aac",
      sample_rate: 48_000,
      channels: 2,
      bitrate: 192_000,
    },
  });

  const cacheKey = createProbeCacheKey({
    asset_id: probe.asset_id,
    source_uri: probe.source_uri,
    source_fingerprint: sourceFingerprint,
  });

  const write = await saveProbeResultToCache(rootDir, {
    result: probe,
    source_fingerprint: sourceFingerprint,
    cached_at: "2026-06-19T00:02:00.000Z",
  });

  expectEqual(write.record.schema_version, PROBE_CACHE_SCHEMA_VERSION, "Cache schema version should match");
  expectEqual(write.record.cache_key, cacheKey, "Cache key should be deterministic");
  expectEqual(write.record.probe.probe_id, probe.probe_id, "Cached probe ID should match source probe");
  expectEqual(write.cache_path, getProbeCachePath(rootDir, cacheKey), "Cache path should match deterministic path helper");
  expectTrue(write.cache_path.endsWith(".json"), "Probe cache records should be JSON files");

  const rawJson = await readFile(write.cache_path, "utf8");
  const parsed = parseProbeCacheRecord(rawJson);
  expectEqual(parsed.cache_key, cacheKey, "Parsed record should preserve cache key");
  expectEqual(parsed.probe.metadata?.video?.width, 1920, "Parsed record should preserve video width");

  const loadedRecord = await loadProbeCacheRecord(rootDir, cacheKey);
  expectEqual(loadedRecord.asset_id, "hero-video", "Loaded cache record should preserve asset ID");
  expectEqual(loadedRecord.source_fingerprint, sourceFingerprint, "Loaded cache record should preserve source fingerprint");

  const loadedProbe = await loadProbeResultFromCache(rootDir, {
    asset_id: probe.asset_id,
    source_uri: probe.source_uri,
    source_fingerprint: sourceFingerprint,
  });
  if (!loadedProbe) throw new Error("Expected probe result to load from cache");
  expectEqual(loadedProbe.status, "probed", "Loaded probe should preserve status");
  expectEqual(loadedProbe.metadata?.container?.duration_seconds, 12.5, "Loaded probe should preserve duration");
  expectEqual(loadedProbe.metadata?.audio?.channels, 2, "Loaded probe should preserve audio channels");

  const missingProbe = await loadProbeResultFromCache(rootDir, {
    asset_id: probe.asset_id,
    source_uri: probe.source_uri,
    source_fingerprint: "size=9999;mtime=changed",
  });
  expectEqual(missingProbe, undefined, "Changed fingerprint should miss the probe cache");

  console.log("probe-cache-smoke-test passed");
} finally {
  await rm(rootDir, { recursive: true, force: true });
}
