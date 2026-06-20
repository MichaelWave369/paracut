import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

import { createMediaProbeForAsset } from "../packages/media-probe-core/src/index";
import { saveProbeResultToCache, loadProbeResultFromCache } from "../packages/probe-cache-core/src/index";
import {
  fingerprintSource,
  sourceFingerprintToProbeCacheInput,
  SOURCE_FINGERPRINT_SCHEMA_VERSION,
} from "../packages/source-fingerprint-core/src/index";
import { createProject, importMediaToProject } from "../packages/project-core/src/index";

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function expectNotEqual<T>(actual: T, expected: T, message: string): void {
  if (actual === expected) {
    throw new Error(`${message}. Did not expect ${String(actual)}.`);
  }
}

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const rootDir = await mkdtemp(join(tmpdir(), "paracut-source-fingerprint-"));

try {
  const mediaDir = join(rootDir, "media");
  await mkdir(mediaDir, { recursive: true });

  const videoPath = join(mediaDir, "hero-video.mp4");
  await writeFile(videoPath, "first media payload", "utf8");
  const videoUri = pathToFileURL(videoPath).href;

  let project = createProject({
    project_id: "source-fingerprint-smoke",
    name: "Source Fingerprint Smoke",
    created_at: "2026-06-19T00:00:00.000Z",
  });

  project = importMediaToProject(project, {
    asset_id: "hero-video",
    kind: "video",
    name: "Hero Video",
    uri: videoUri,
  });

  const asset = project.media.assets.find((candidate) => candidate.asset_id === "hero-video");
  if (!asset) throw new Error("Expected imported asset for source fingerprint smoke test");

  const fingerprint = await fingerprintSource({
    asset_id: asset.asset_id,
    source_uri: asset.uri,
    project_root_dir: rootDir,
    fingerprinted_at: "2026-06-19T00:01:00.000Z",
  });

  expectEqual(fingerprint.schema_version, SOURCE_FINGERPRINT_SCHEMA_VERSION, "Fingerprint schema version should match");
  expectEqual(fingerprint.status, "fingerprinted", "Local media file should fingerprint successfully");
  expectEqual(fingerprint.source_uri, videoUri, "Fingerprint should preserve media source URI");
  expectTrue(Boolean(fingerprint.fingerprint), "Successful fingerprint should include fingerprint string");
  expectTrue(fingerprint.size_bytes !== undefined && fingerprint.size_bytes > 0, "Fingerprint should include file size");

  if (!fingerprint.fingerprint) throw new Error("Expected successful fingerprint string");
  if (fingerprint.size_bytes === undefined) throw new Error("Expected successful fingerprint size");
  const originalFingerprint = fingerprint.fingerprint;
  const originalSizeBytes = fingerprint.size_bytes;

  const probe = createMediaProbeForAsset(asset, {
    project_id: project.project_id,
    source: "mock",
    probed_at: "2026-06-19T00:02:00.000Z",
    container: {
      format_name: "mov,mp4,m4a,3gp,3g2,mj2",
      duration_seconds: 18,
      bitrate: 4_000_000,
      size_bytes: originalSizeBytes,
    },
    video: {
      codec: "h264",
      width: 1920,
      height: 1080,
      fps: 30,
      bitrate: 3_500_000,
    },
    audio: {
      codec: "aac",
      sample_rate: 48_000,
      channels: 2,
      bitrate: 192_000,
    },
  });

  await saveProbeResultToCache(rootDir, {
    result: probe,
    source_fingerprint: originalFingerprint,
    cached_at: "2026-06-19T00:03:00.000Z",
  });

  const cacheInput = sourceFingerprintToProbeCacheInput(fingerprint);
  const loadedProbe = await loadProbeResultFromCache(rootDir, cacheInput);
  if (!loadedProbe) throw new Error("Expected probe to load using source fingerprint cache input");
  expectEqual(loadedProbe.probe_id, probe.probe_id, "Loaded probe should match cached probe");
  expectEqual(loadedProbe.metadata?.video?.width, 1920, "Loaded probe should preserve video metadata");

  await writeFile(videoPath, "updated media payload with different size", "utf8");
  const changedFingerprint = await fingerprintSource({
    asset_id: asset.asset_id,
    source_uri: asset.uri,
    project_root_dir: rootDir,
    fingerprinted_at: "2026-06-19T00:04:00.000Z",
  });

  expectEqual(changedFingerprint.status, "fingerprinted", "Changed local file should still fingerprint");
  if (!changedFingerprint.fingerprint) throw new Error("Expected changed fingerprint string");
  expectNotEqual(changedFingerprint.fingerprint, originalFingerprint, "Changed local file should produce a different fingerprint");

  const missingAfterChange = await loadProbeResultFromCache(
    rootDir,
    sourceFingerprintToProbeCacheInput(changedFingerprint),
  );
  expectEqual(missingAfterChange, undefined, "Changed local file should miss previous probe cache entry");

  const relativePath = "media/relative-image.png";
  await writeFile(join(rootDir, relativePath), "image payload", "utf8");
  const relativeFingerprint = await fingerprintSource({
    source_uri: relativePath,
    project_root_dir: rootDir,
    fingerprinted_at: "2026-06-19T00:05:00.000Z",
  });
  expectEqual(relativeFingerprint.status, "fingerprinted", "Relative local media should fingerprint against project root");
  expectEqual(relativeFingerprint.source_uri, relativePath, "Relative fingerprint should preserve relative source URI");
  expectEqual(relativeFingerprint.normalized_uri, relativePath, "Relative fingerprint should keep normalized URI portable");

  const unsupported = await fingerprintSource({
    source_uri: "https://example.com/remote-video.mp4",
    fingerprinted_at: "2026-06-19T00:06:00.000Z",
  });
  expectEqual(unsupported.status, "unsupported", "Remote media should not be filesystem-fingerprinted in v0.12");

  const missing = await fingerprintSource({
    source_uri: "media/missing.mov",
    project_root_dir: rootDir,
    fingerprinted_at: "2026-06-19T00:07:00.000Z",
  });
  expectEqual(missing.status, "missing", "Missing local media should return a missing fingerprint status");

  console.log("source-fingerprint-smoke-test passed");
} finally {
  await rm(rootDir, { recursive: true, force: true });
}
