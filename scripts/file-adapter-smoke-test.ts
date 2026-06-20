import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  loadProjectFolder,
  saveProjectFolder,
} from "../packages/file-adapter-core/src/index";
import {
  addClipToProject,
  addTrackToProject,
  createProject,
  importMediaToProject,
  planRenderJobForProject,
  queueRenderJobForProject,
} from "../packages/project-core/src/index";
import { DEFAULT_EXPORT_PRESETS } from "../packages/render-core/src/index";

const expectEqual = <T>(actual: T, expected: T, message: string): void => {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
};

const now = "2026-06-19T12:00:00.000-07:00";
const verticalPreset = DEFAULT_EXPORT_PRESETS.find(
  (candidate) => candidate.preset_id === "preset_vertical_1080x1920",
);

if (!verticalPreset) {
  throw new Error("Vertical export preset should exist");
}

let project = createProject({
  project_id: "project_paracut_file_adapter_smoke",
  name: "ParaCut File Adapter Smoke Test",
  created_at: now,
  metadata: {
    purpose: "Prove project folder save/load.",
  },
});

project = importMediaToProject(project, {
  asset_id: "asset_file_adapter_video",
  kind: "video",
  name: "file-adapter.mov",
  uri: "file://media/file-adapter.mov",
  duration_seconds: 12,
  imported_at: now,
});

project = addTrackToProject(project, {
  track_id: "track_video_1",
  kind: "video",
  name: "Video 1",
});

project = addClipToProject(project, {
  clip_id: "clip_file_adapter",
  asset_id: "asset_file_adapter_video",
  track_id: "track_video_1",
  timeline: { start: 0, end: 6 },
  source: { start: 0, end: 6 },
});

project = queueRenderJobForProject(project, {
  job_id: "render_file_adapter_test",
  preset: verticalPreset,
  output_uri: "file://exports/file-adapter-smoke.mp4",
});

const planned = planRenderJobForProject(project, "render_file_adapter_test", now);
project = planned.project;

const tempRoot = await mkdtemp(join(tmpdir(), "paracut-file-adapter-"));

try {
  const saved = await saveProjectFolder(project, tempRoot);
  const loaded = await loadProjectFolder(tempRoot);

  expectEqual(saved.manifest.schema_version, "paracut.folder.v0", "Folder schema should match");
  expectEqual(loaded.project.project_id, project.project_id, "Loaded project id should match");
  expectEqual(loaded.project.name, project.name, "Loaded project name should match");
  expectEqual(loaded.project.media.assets.length, 1, "Loaded media count should match");
  expectEqual(loaded.project.timeline.tracks.length, 1, "Loaded track count should match");
  expectEqual(loaded.project.render_jobs.length, 1, "Loaded render job count should match");
  expectEqual(loaded.receipts.length, project.ledger.length, "Loaded receipt count should match");
  expectEqual(loaded.manifest.counts.receipts, project.ledger.length, "Manifest receipt count should match");

  console.log("ParaCut file adapter smoke test passed.");
  console.log(`Project folder: ${loaded.paths.root_dir}`);
  console.log(`Receipts loaded: ${loaded.receipts.length}`);
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
