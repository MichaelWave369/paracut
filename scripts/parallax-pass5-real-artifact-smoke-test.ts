import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createMediaImportReference } from "../packages/media-import-core/src/index";
import { parallaxBridgeToMediaImportInput } from "../packages/media-import-core/src/parallax";
import type { RenderPlan } from "../packages/render-core/src/index";
import { renderPlanToWaveForgeBridge } from "../packages/render-core/src/parallax";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error("Unsupported canonical JSON value");
    return encoded;
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
}

const artifact = JSON.parse(
  await readFile(new URL("./fixtures/parallax-pass5-artifact.json", import.meta.url), "utf8"),
);
const frozenWaveForgeBridge = JSON.parse(
  await readFile(new URL("./fixtures/parallax-pass5-waveforge-bridge.json", import.meta.url), "utf8"),
);

const encodedArtifact = String(artifact.data_uri).split(",", 2)[1];
if (!encodedArtifact) throw new Error("Pass 5 fixture must contain a base64 data URI");
const artifactBytes = Buffer.from(encodedArtifact, "base64");
const artifactSha256 = createHash("sha256").update(artifactBytes).digest("hex");
assert.equal(artifactBytes.length, artifact.bytes, "Pass 5 artifact byte count must match the frozen fixture");
assert.equal(artifactSha256, artifact.sha256, "Pass 5 artifact SHA-256 must match the frozen fixture");

const creativeBridge = {
  schema: "parallax.bridge.v1" as const,
  protocol: "parallax-bridge" as const,
  version: 1 as const,
  transferId: `creative:2026-08-25T22:00:00Z:${artifact.name}`,
  source: "Domistika" as const,
  target: "Auralith369" as const,
  createdAt: "2026-08-25T22:00:00Z",
  localOnly: true,
  payloadType: "image/data-url+creative-metadata",
  payloadRefOrInline: {
    native: {
      protocol: "parallax-creative-bridge",
      version: 1,
      source: "domistika",
      target: "auralith369",
      createdAt: "2026-08-25T22:00:00Z",
      name: artifact.name,
      image: artifact.data_uri,
      canvas: { width: artifact.width, height: artifact.height },
      note: artifact.rights_note,
    },
  },
  contentHash: `sha256:${artifactSha256}`,
  warnings: [],
  requiresUserAction: true,
};

const importInput = parallaxBridgeToMediaImportInput(creativeBridge);
const reference = createMediaImportReference(importInput);
assert.equal(reference.media_input.hash?.algorithm, "sha256");
assert.equal(reference.media_input.hash?.value, artifact.sha256);
assert.equal(reference.media_input.uri, artifact.data_uri);
assert.equal(reference.media_input.metadata?.width, 128);
assert.equal(reference.media_input.metadata?.height, 128);
assert.equal(reference.copy_policy, "reference-only");
assert.equal(reference.intent, "image-overlay");
assert.equal(reference.asset_id, "asset_parallax_pass_5_deterministic_test_artifact");

const plan: RenderPlan = {
  plan_id: "plan_pass5_real_artifact_001",
  job_id: "job_pass5_real_artifact_001",
  project_id: "project_pass5_real_artifact_001",
  output_uri: "./exports/pass5-real-artifact.mp4",
  preset: {
    preset_id: "preset_wide_1080p",
    name: "Wide 1080p",
    platform: "wide",
    width: 1920,
    height: 1080,
    fps: 30,
    video_codec: "h264",
    audio_codec: "aac",
    container: "mp4",
  },
  duration_seconds: 12,
  inputs: [
    {
      input_id: "input_0",
      input_index: 0,
      asset_id: reference.asset_id,
      uri: reference.media_input.uri,
      kind: "image",
      name: reference.media_input.name,
    },
  ],
  clips: [
    {
      clip_id: "clip_1",
      asset_id: reference.asset_id,
      input_id: "input_0",
      input_index: 0,
      track_id: "video_1",
      track_kind: "video",
      timeline_start: 0,
      timeline_end: 12,
      source_start: 0,
      source_end: 12,
      enabled: true,
    },
  ],
  filter_graph: [],
  argv: ["ffmpeg", "-i", reference.media_input.uri, "./exports/pass5-real-artifact.mp4"],
  warnings: [],
  created_at: "2026-08-25T22:10:00Z",
};

const planSha256 = createHash("sha256").update(canonicalJson(plan), "utf8").digest("hex");
assert.equal(planSha256, "dbfaa18ae5cfff24a8252f69f18ffe69e72afba3f0a729c6eb3bb32668c53710");

const waveForgeBridge = renderPlanToWaveForgeBridge(plan, {
  contentHash: `sha256:${planSha256}`,
  createdAt: "2026-08-25T22:10:00Z",
});
assert.deepEqual(waveForgeBridge, frozenWaveForgeBridge, "ParaCut must reproduce the frozen Pass 5 WaveForge bridge packet exactly");

console.log("ParaCut Pass 5 real-artifact chain smoke passed", {
  artifactBytes: artifactBytes.length,
  artifactSha256,
  assetId: reference.asset_id,
  planSha256,
  bridgeContentHash: waveForgeBridge.contentHash,
});
