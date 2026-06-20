import {
  addClipToProject,
  addTrackToProject,
  createProject,
  importMediaToProject,
  planRenderJobForProject,
  queueRenderJobForProject,
  type ParaCutProject,
} from "../../../packages/project-core/src/index";
import { DEFAULT_EXPORT_PRESETS } from "../../../packages/render-core/src/index";

import { attachProjectToDesktopShell, createDesktopShellState, type DesktopShellState } from "./shell";

export function createDesktopSampleProject(): ParaCutProject {
  let project = createProject({
    project_id: "desktop_sample_project",
    name: "ParaCut Desktop Sample",
    created_at: "2026-06-19T12:00:00.000Z",
    metadata: {
      purpose: "desktop-shell-smoke-test",
    },
  });

  project = importMediaToProject(project, {
    asset_id: "asset_intro_video",
    kind: "video",
    name: "intro-video.mp4",
    uri: "file:///sample/intro-video.mp4",
    duration_seconds: 12,
    rights_note: "Synthetic smoke-test media reference.",
  });

  project = addTrackToProject(project, {
    track_id: "track_video_1",
    kind: "video",
    name: "Video 1",
  });

  project = addTrackToProject(project, {
    track_id: "track_audio_1",
    kind: "audio",
    name: "Audio 1",
  });

  project = addClipToProject(project, {
    clip_id: "clip_intro_1",
    asset_id: "asset_intro_video",
    track_id: "track_video_1",
    timeline: { start: 0, end: 12 },
    source: { start: 0, end: 12 },
  });

  const verticalPreset = DEFAULT_EXPORT_PRESETS.find(
    (preset) => preset.preset_id === "preset_vertical_1080x1920",
  );
  if (!verticalPreset) throw new Error("Missing vertical default export preset");

  project = queueRenderJobForProject(project, {
    job_id: "render_desktop_sample_vertical",
    preset: verticalPreset,
    output_uri: "file:///sample/exports/desktop-sample.mp4",
    created_at: "2026-06-19T12:01:00.000Z",
  });

  const planned = planRenderJobForProject(
    project,
    "render_desktop_sample_vertical",
    "2026-06-19T12:02:00.000Z",
  );

  return planned.project;
}

export function createDesktopSampleShellState(): DesktopShellState {
  return attachProjectToDesktopShell(
    createDesktopShellState(),
    createDesktopSampleProject(),
    null,
    "2026-06-19T12:03:00.000Z",
  );
}
