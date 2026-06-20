import {
  addClipToProject,
  addTrackToProject,
  createProject,
  getProjectMedia,
  importMediaToProject,
} from "../packages/project-core/src/index";
import {
  applyMediaProbeResultToProject,
  createMediaProbeForAsset,
  createMediaProbeResult,
  pickDurationSeconds,
} from "../packages/media-probe-core/src/index";

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

let project = createProject({
  project_id: "probe_project_001",
  name: "Probe Smoke Project",
  created_at: "2026-06-19T10:00:00.000Z",
});

project = importMediaToProject(project, {
  asset_id: "asset_probe_video",
  kind: "video",
  name: "probe-video.mp4",
  uri: "./media/probe-video.mp4",
  rights_note: "Smoke-test media reference only.",
  imported_at: "2026-06-19T10:01:00.000Z",
});

let asset = getProjectMedia(project, "asset_probe_video");
if (!asset) throw new Error("Expected imported probe asset");
expectEqual(asset.duration_seconds, undefined, "Asset should begin without duration metadata");

const probe = createMediaProbeForAsset(asset, {
  project_id: project.project_id,
  probe_id: "probe_video_001",
  source: "mock",
  probed_at: "2026-06-19T10:02:00.000Z",
  container: {
    format_name: "mov,mp4,m4a,3gp,3g2,mj2",
    duration_seconds: 12.5,
    bitrate: 4_200_000,
    size_bytes: 6_500_000,
  },
  video: {
    codec: "h264",
    width: 1920,
    height: 1080,
    fps: 29.97,
    bitrate: 3_800_000,
  },
  audio: {
    codec: "aac",
    sample_rate: 48_000,
    channels: 2,
    bitrate: 192_000,
  },
});

expectEqual(pickDurationSeconds(probe.metadata!), 12.5, "Probe duration should prefer container duration");

const applied = applyMediaProbeResultToProject(project, probe);
project = applied.project;

asset = getProjectMedia(project, "asset_probe_video");
if (!asset) throw new Error("Expected probed asset");
expectEqual(asset.duration_seconds, 12.5, "Probe should enrich asset duration");
expectEqual(asset.metadata?.width, 1920, "Probe should enrich width");
expectEqual(asset.metadata?.height, 1080, "Probe should enrich height");
expectEqual(asset.metadata?.fps, 29.97, "Probe should enrich fps");
expectEqual(asset.metadata?.codec, "h264", "Probe should prefer video codec");
expectEqual(asset.metadata?.sample_rate, 48_000, "Probe should enrich audio sample rate");
expectEqual(asset.metadata?.channels, 2, "Probe should enrich audio channels");
expectEqual(project.ledger.at(-1)?.type, "media.probe.completed", "Probe completion should be recorded");
expectEqual(project.ledger.at(-1)?.payload["stream_count"], 2, "Probe receipt should record stream count");

project = addTrackToProject(project, {
  track_id: "video_track_001",
  kind: "video",
  name: "Video",
});

project = addClipToProject(project, {
  clip_id: "clip_probe_001",
  asset_id: "asset_probe_video",
  track_id: "video_track_001",
  timeline: { start: 0, end: 12.5 },
  source: { start: 0, end: 12.5 },
});

const failedProbe = createMediaProbeResult({
  project_id: project.project_id,
  asset_id: "asset_probe_video",
  source_uri: "./media/probe-video.mp4",
  probe_id: "probe_video_failed_001",
  source: "ffprobe",
  probed_at: "2026-06-19T10:03:00.000Z",
  status: "failed",
  errors: ["ffprobe unavailable in smoke test environment"],
});

project = applyMediaProbeResultToProject(project, failedProbe).project;
asset = getProjectMedia(project, "asset_probe_video");
if (!asset) throw new Error("Expected asset after failed probe");
expectEqual(asset.duration_seconds, 12.5, "Failed probe should not erase known duration");
expectEqual(project.ledger.at(-1)?.type, "media.probe.failed", "Failed probe should be recorded");
expectEqual(project.ledger.length, 6, "Probe smoke should record six receipts");

expectTrue(true, "media probe smoke completed");
console.log("media probe smoke ok");
