import { createProject } from "../packages/project-core/src/index";
import {
  applyMediaImportBatchToProject,
  createMediaImportBatch,
  createMediaImportReference,
} from "../packages/media-import-core/src/index";

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const createdAt = "2026-06-19T12:00:00.000Z";

let project = createProject({
  project_id: "project_media_import_smoke",
  name: "Media Import Smoke",
  created_at: createdAt,
});

const { project: importedProject, batch } = applyMediaImportBatchToProject(
  project,
  [
    {
      source_uri: "/creator/raw/intro.mov",
      duration_seconds: 12.5,
      rights_note: "Original camera footage owned by the creator.",
    },
    {
      source_uri: "./audio/theme.wav",
      duration_seconds: 30,
      rights_note: "Licensed music loop for test project.",
      copy_policy: "proxy-later",
    },
    {
      source_uri: "https://example.com/brand/logo.png?version=1",
      rights_note: "Brand logo reference for layout testing.",
    },
  ],
  {
    batch_id: "batch_media_import_smoke",
    created_at: "2026-06-19T12:01:00.000Z",
  },
);

project = importedProject;

expectEqual(batch.batch_id, "batch_media_import_smoke", "Batch id should be preserved");
expectEqual(batch.items.length, 3, "Batch should contain three import references");
expectEqual(project.media.assets.length, 3, "Project should contain three imported assets");
expectEqual(project.ledger.length, 5, "Project should contain project + three media imports + batch receipt");
expectEqual(project.ledger.at(-1)?.type, "media.import.batch.created", "Final receipt should record the batch");

const video = batch.items.find((item) => item.kind === "video");
const audio = batch.items.find((item) => item.kind === "audio");
const image = batch.items.find((item) => item.kind === "image");

if (!video) throw new Error("Expected video import reference");
if (!audio) throw new Error("Expected audio import reference");
if (!image) throw new Error("Expected image import reference");

expectEqual(video.asset_id, "asset_intro", "Video asset id should be inferred from filename");
expectEqual(video.workspace_targets.proxy_uri, ".paracut/proxies/asset_intro.mp4", "Video proxy target should be prepared");
expectEqual(video.workspace_targets.thumbnail_uri, ".paracut/thumbnails/asset_intro.jpg", "Video thumbnail target should be prepared");
expectEqual(video.workspace_targets.waveform_uri, ".paracut/waveforms/asset_intro.json", "Video waveform target should be prepared");
expectEqual(audio.workspace_targets.waveform_uri, ".paracut/waveforms/asset_theme.json", "Audio waveform target should be prepared");
expectEqual(image.scheme, "https", "Remote image scheme should be detected");
expectTrue(image.warnings.some((warning) => warning.includes("Remote media")), "Remote image should carry a warning");
expectTrue(batch.warning_count >= 2, "Batch should carry rights/proxy/remote warnings");

const inlineReference = createMediaImportReference({
  source_uri: "data:image/png;base64,AAAA",
  rights_note: "Generated test image.",
});
expectEqual(inlineReference.kind, "image", "Data image kind should be inferred");
expectEqual(inlineReference.intent, "image-overlay", "Image intent should be inferred");

const duplicateBatch = createMediaImportBatch(
  [
    { source_uri: "./clips/take.mp4", duration_seconds: 4, rights_note: "Test clip A." },
    { source_uri: "./clips/take.mp4", duration_seconds: 4, rights_note: "Test clip B." },
  ],
  { created_at: "2026-06-19T12:02:00.000Z" },
);

const firstDuplicate = duplicateBatch.items[0];
const secondDuplicate = duplicateBatch.items[1];
if (!firstDuplicate || !secondDuplicate) throw new Error("Expected duplicate batch items");

expectEqual(firstDuplicate.asset_id, "asset_take", "First duplicate keeps inferred id");
expectEqual(secondDuplicate.asset_id, "asset_take_2", "Second duplicate should be renamed safely");
expectTrue(
  secondDuplicate.warnings.some((warning) => warning.includes("renamed")),
  "Renamed duplicate should carry a warning",
);

console.log("ParaCut media import smoke test passed", {
  assetCount: project.media.assets.length,
  receiptCount: project.ledger.length,
  batchWarnings: batch.warning_count,
  duplicateAssetIds: duplicateBatch.items.map((item) => item.asset_id),
});
