import type { RenderPlan } from "../packages/render-core/src/index";
import { renderPlanToWaveForgeBridge } from "../packages/render-core/src/parallax";

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const plan: RenderPlan = {
  plan_id: "plan_interop_001",
  job_id: "job_interop_001",
  project_id: "project_interop_001",
  output_uri: "./exports/interop.mp4",
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
      asset_id: "asset_interop_bloom",
      uri: "data:image/webp;base64,QUJD",
      kind: "image",
      name: "Interop Bloom",
    },
  ],
  clips: [
    {
      clip_id: "clip_1",
      asset_id: "asset_interop_bloom",
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
  argv: ["ffmpeg", "-i", "data:image/webp;base64,QUJD", "./exports/interop.mp4"],
  warnings: [],
  created_at: "2026-08-25T17:15:00Z",
};

const hash = `sha256:${"b".repeat(64)}`;
const bridge = renderPlanToWaveForgeBridge(plan, { contentHash: hash });
expectEqual(bridge.schema, "parallax.bridge.v1", "Bridge schema should be Parallax v1");
expectEqual(bridge.source, "ParaCut", "Bridge source should be ParaCut");
expectEqual(bridge.target, "WaveForgeStudio", "Bridge target should be WaveForgeStudio");
expectEqual(bridge.localOnly, true, "Bridge should stay local-only");
expectEqual(bridge.requiresUserAction, true, "Bridge should require explicit user action");
expectEqual(bridge.contentHash, hash, "Caller-supplied render-plan hash should be preserved");
expectEqual(bridge.payloadRefOrInline.native, plan, "Native RenderPlan should be preserved by reference");
expectTrue(
  bridge.compatibilityNotes.some((note) => note.includes("must not treat this bridge as render authorization")),
  "Bridge should explicitly deny render authority",
);

const unhashed = renderPlanToWaveForgeBridge(plan);
expectEqual(unhashed.contentHash, null, "Missing hash must remain null");
expectTrue(unhashed.warnings.length === 1, "Missing hash should be visible as one warning");

console.log("ParaCut → WaveForge Parallax bridge smoke test passed", {
  planId: plan.plan_id,
  contentHash: bridge.contentHash,
  requiresUserAction: bridge.requiresUserAction,
});
