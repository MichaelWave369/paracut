import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { createMediaImportReference } from "../packages/media-import-core/src/index";
import {
  type ParallaxCreativeBridgeV2,
  verifiedParallaxBridgeV2ToMediaImportBundle,
  verifyParallaxCreativeBridgeV2,
} from "../packages/media-import-core/src/parallax";
import type { RenderPlan } from "../packages/render-core/src/index";
import { renderPlanToWaveForgeBridgeV2 } from "../packages/render-core/src/parallax";


const frozenSpec = await readFile(new URL("../docs/PARALLAX_CREATIVE_INTEROP_V2.md", import.meta.url));
const frozenManifest = JSON.parse(
  await readFile(new URL("../parallax-creative-interop.v2.json", import.meta.url), "utf8"),
);
const frozenSpecHash = createHash("sha256").update(frozenSpec).digest("hex");
assert.equal(
  frozenSpecHash,
  frozenManifest.spec_sha256,
  "Creative Interop v2 manifest must bind the exact frozen profile text",
);
assert.equal(frozenManifest.protocol_id, "parallax.creative-interop.v2");
assert.equal(frozenManifest.status, "candidate_pending_repository_ratification");
assert.equal(
  frozenManifest.optional_extensions[0].status,
  "unratified_receiver",
  "CineSwarm extension must remain explicitly unratified",
);

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map((item) => canonicalJson(item)).join(",") + "]";
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return "{" + entries.map(([key, item]) => JSON.stringify(key) + ":" + canonicalJson(item)).join(",") + "}";
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("Unsupported canonical value");
  return encoded;
}

const sha = (bytes: string | Buffer) =>
  "sha256:" + createHash("sha256").update(bytes).digest("hex");

const dataUri = (text: string) =>
  "data:image/png;base64," + Buffer.from(text, "utf8").toString("base64");

const baseImage = dataUri("creative-interop-v2-base");
const titleImage = dataUri("creative-interop-v2-title");

const native = {
  protocol: "parallax-creative-bridge" as const,
  version: 2 as const,
  source: "domistika" as const,
  target: "auralith369" as const,
  createdAt: "2026-09-28T18:51:00-07:00",
  name: "Harbor Bridge v3",
  image: baseImage,
  canvas: { width: 1400, height: 1000 },
  palette: ["#060824", "#2040ff"],
  symmetry: "none",
  note: "Creator-controlled semantic bridge fixture.",
  baseContentHash: sha(Buffer.from(baseImage.split(",", 2)[1]!, "base64")),
  overlays: [{
    id: "overlay-1",
    kind: "raster-overlay" as const,
    role: "type" as const,
    name: "Title",
    sourceLayerId: "layer-title",
    preserveDuringStyle: true,
    opacity: 1,
    blendMode: "normal",
    semantic: [{
      kind: "text",
      schema: "domistika.semantic-text.v1",
      text: "Harbor Bridge v3",
      x: 0.04,
      y: 0.05,
      preserveDuringStyle: true,
    }],
    image: titleImage,
    contentHash: sha(Buffer.from(titleImage.split(",", 2)[1]!, "base64")),
  }],
};

const manifest = {
  protocol: native.protocol,
  version: native.version,
  source: native.source,
  target: native.target,
  createdAt: native.createdAt,
  name: native.name,
  canvas: native.canvas,
  palette: native.palette,
  symmetry: native.symmetry,
  note: native.note,
  baseContentHash: native.baseContentHash,
  overlays: native.overlays.map((overlay) => ({
    id: overlay.id,
    kind: overlay.kind,
    role: overlay.role,
    name: overlay.name,
    sourceLayerId: overlay.sourceLayerId,
    preserveDuringStyle: overlay.preserveDuringStyle,
    opacity: overlay.opacity,
    blendMode: overlay.blendMode,
    semantic: overlay.semantic,
    contentHash: overlay.contentHash,
  })),
};
const manifestHash = sha(canonicalJson(manifest));
const captureHash = sha("auralith-finished-capture");
const receiptHash = sha("auralith-creative-receipt");

const bridge: ParallaxCreativeBridgeV2 = {
  schema: "parallax.bridge.v2",
  protocol: "parallax-bridge",
  version: 2,
  transferId: "creative-v2:harbor-bridge-v3",
  source: "Domistika",
  target: "Auralith369",
  createdAt: native.createdAt,
  localOnly: true,
  payloadType: "image/data-url+semantic-overlays",
  payloadRefOrInline: {
    native: {
      ...native,
      contentHash: manifestHash,
    },
  },
  contentHash: manifestHash,
  creativeEvidence: {
    auralithCaptureHash: captureHash,
    auralithCaptureSchema: "auralith.capture.png.v1",
    auralithReceiptHash: receiptHash,
    auralithReceiptSchema: "auralith.receipt",
  },
  trustLabels: ["semantic-overlay-bound"],
  warnings: [],
  compatibilityNotes: [],
  lineageRef: null,
  requiresUserAction: true,
};

await verifyParallaxCreativeBridgeV2(bridge);
const bundle = await verifiedParallaxBridgeV2ToMediaImportBundle(bridge);

assert.equal(bundle.lineage.profile, "parallax.creative-interop.v2");
assert.equal(bundle.lineage.creativeManifestHash, manifestHash);
assert.equal(bundle.lineage.baseContentHash, native.baseContentHash);
assert.deepEqual(bundle.lineage.overlayContentHashes, [native.overlays[0].contentHash]);
assert.equal(bundle.lineage.semanticOverlayCount, 1);
assert.equal(bundle.lineage.auralithCaptureHash, captureHash);
assert.equal(bundle.lineage.auralithReceiptHash, receiptHash);

const baseRef = createMediaImportReference(bundle.base);
const overlayRef = createMediaImportReference(bundle.overlays[0]!);
assert.equal(baseRef.copy_policy, "reference-only");
assert.equal(overlayRef.copy_policy, "reference-only");
assert.equal(baseRef.media_input.hash?.value, native.baseContentHash.slice("sha256:".length));
assert.equal(overlayRef.media_input.hash?.value, native.overlays[0].contentHash.slice("sha256:".length));

const plan: RenderPlan = {
  plan_id: "plan_interop_v2_001",
  job_id: "job_interop_v2_001",
  project_id: "project_interop_v2_001",
  output_uri: "./exports/interop-v2.mp4",
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
  inputs: [baseRef, overlayRef].map((reference, index) => ({
    input_id: "input_" + index,
    input_index: index,
    asset_id: reference.asset_id,
    uri: reference.media_input.uri,
    kind: "image",
    name: reference.name,
  })),
  clips: [
    {
      clip_id: "clip-base",
      asset_id: baseRef.asset_id,
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
    {
      clip_id: "clip-title",
      asset_id: overlayRef.asset_id,
      input_id: "input_1",
      input_index: 1,
      track_id: "video_2",
      track_kind: "video",
      timeline_start: 0,
      timeline_end: 12,
      source_start: 0,
      source_end: 12,
      enabled: true,
    },
  ],
  filter_graph: [],
  argv: [],
  warnings: [],
  created_at: "2026-09-28T18:55:00-07:00",
};

const planHash = sha(canonicalJson(plan));
const waveForgeBridge = renderPlanToWaveForgeBridgeV2(plan, {
  contentHash: planHash,
  planRevision: 1,
  creativeLineage: {
    ...bundle.lineage,
    paraCutAssetHashes: [
      "sha256:" + baseRef.media_input.hash!.value,
      "sha256:" + overlayRef.media_input.hash!.value,
    ],
  },
});

assert.equal(waveForgeBridge.schema, "parallax.bridge.v2");
assert.equal(waveForgeBridge.version, 2);
assert.equal(waveForgeBridge.interopProfile, "parallax.creative-interop.v2");
assert.equal(waveForgeBridge.contentHash, planHash);
assert.equal(waveForgeBridge.planRevision, 1);
assert.equal(waveForgeBridge.requiresUserAction, true);
assert.equal(waveForgeBridge.localOnly, true);
assert.equal(waveForgeBridge.authority.realRenderingAuthorized, false);
assert.equal(waveForgeBridge.authority.networkAuthorized, false);
assert.equal(waveForgeBridge.authority.subprocessAuthorized, false);
assert.equal(waveForgeBridge.authority.automaticImportAuthorized, false);
assert.equal(waveForgeBridge.authority.publishAuthorized, false);
assert.equal(waveForgeBridge.creativeLineage.creativeManifestHash, manifestHash);

const tamperedOverlay: ParallaxCreativeBridgeV2 = structuredClone(bridge);
tamperedOverlay.payloadRefOrInline.native.overlays[0]!.image = dataUri("tampered-title");
await assert.rejects(
  verifyParallaxCreativeBridgeV2(tamperedOverlay),
  /overlay overlay-1 contentHash does not match image bytes/,
);

const tamperedSemantic: ParallaxCreativeBridgeV2 = structuredClone(bridge);
(tamperedSemantic.payloadRefOrInline.native.overlays[0]!.semantic as Array<Record<string, unknown>>)[0]!.text = "Altered";
await assert.rejects(
  verifyParallaxCreativeBridgeV2(tamperedSemantic),
  /manifest contentHash does not match semantic manifest/,
);

const escalated: ParallaxCreativeBridgeV2 = { ...bridge, requiresUserAction: false };
await assert.rejects(
  verifyParallaxCreativeBridgeV2(escalated),
  /must remain local and require explicit user action/,
);

console.log("Parallax Creative Interop v2 lineage smoke passed", {
  creativeManifestHash: manifestHash,
  baseContentHash: native.baseContentHash,
  overlayContentHash: native.overlays[0].contentHash,
  auralithCaptureHash: captureHash,
  auralithReceiptHash: receiptHash,
  planHash,
  planRevision: waveForgeBridge.planRevision,
});
