import {
  addClipToProject,
  addTrackToProject,
  createProject,
  importMediaToProject,
  moveClipInProject,
  planRenderJobForProject,
  queueRenderJobForProject,
  serializeProject,
  splitClipInProject,
  trimClipInProject,
} from "../packages/project-core/src/index";
import { DEFAULT_EXPORT_PRESETS, renderPlanToCommandPreview } from "../packages/render-core/src/index";

const expectTrue = (condition: boolean, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const expectEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
};

const now = "2026-06-19T12:00:00.000-07:00";

let project = createProject({
  project_id: "project_paracut_smoke",
  name: "ParaCut Smoke Test",
  created_at: now,
  metadata: {
    purpose: "Prove the first timeline-ledger loop.",
  },
});

project = importMediaToProject(project, {
  asset_id: "asset_intro_video",
  kind: "video",
  name: "intro.mov",
  uri: "file://media/intro.mov",
  duration_seconds: 30,
  imported_at: now,
});

project = addTrackToProject(project, {
  track_id: "track_video_1",
  kind: "video",
  name: "Video 1",
});

project = addTrackToProject(project, {
  track_id: "track_video_2",
  kind: "video",
  name: "Video 2",
});

project = addClipToProject(project, {
  clip_id: "clip_intro",
  asset_id: "asset_intro_video",
  track_id: "track_video_1",
  timeline: { start: 0, end: 10 },
  source: { start: 0, end: 10 },
});

// Trim source 2-10 onto timeline 0-8, then split at timeline 4.
// Moving the right half to timeline start 5 produces a final render span of 0-9.
project = trimClipInProject(
  project,
  "clip_intro",
  { start: 2, end: 10 },
  { start: 0, end: 8 },
);

project = splitClipInProject(project, "clip_intro", 4, "clip_intro_left", "clip_intro_right");
project = moveClipInProject(project, "clip_intro_right", "track_video_2", 5);

const verticalPreset = DEFAULT_EXPORT_PRESETS.find(
  (candidate) => candidate.preset_id === "preset_vertical_1080x1920",
);

if (!verticalPreset) {
  throw new Error("Vertical export preset should exist");
}

project = queueRenderJobForProject(project, {
  job_id: "render_vertical_test",
  preset: verticalPreset,
  output_uri: "file://exports/paracut-smoke.mp4",
});

const planned = planRenderJobForProject(project, "render_vertical_test", now);
project = planned.project;
const plan = planned.plan;
const commandPreview = renderPlanToCommandPreview(plan);

expectEqual(project.media.assets.length, 1, "Media asset count should match");
expectEqual(project.timeline.tracks.length, 2, "Timeline track count should match");
expectEqual(project.timeline.tracks[0]?.clips.length, 1, "Track 1 clip count should match");
expectEqual(project.timeline.tracks[1]?.clips.length, 1, "Track 2 clip count should match");
expectEqual(project.render_jobs.length, 1, "Render job count should match");
expectEqual(project.ledger.length, 10, "Receipt count should match");
expectEqual(plan.inputs.length, 1, "Render plan input count should match");
expectEqual(plan.clips.length, 2, "Render plan clip count should match");
expectEqual(plan.duration_seconds, 9, "Render plan duration should match");
expectTrue(commandPreview.includes("ffmpeg"), "Command preview should include ffmpeg");
expectTrue(
  commandPreview.includes("exports/paracut-smoke.mp4"),
  "Command preview should include output path",
);

console.log("ParaCut smoke test passed.");
console.log(`Receipts: ${project.ledger.length}`);
console.log(`Render plan inputs: ${plan.inputs.length}`);
console.log(`Render plan clips: ${plan.clips.length}`);
console.log(`Command preview: ${commandPreview}`);
console.log(`Project JSON bytes: ${serializeProject(project).length}`);
