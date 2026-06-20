import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildDesktopCommandList,
  createDesktopRuntimeState,
  createDesktopSampleProject,
  getDesktopShellProjectSummary,
  getLoadedDesktopRuntimeProject,
  openProjectFolderInDesktopRuntime,
  replaceDesktopRuntimeProject,
  saveDesktopRuntimeProject,
  saveDesktopRuntimeProjectAs,
} from "../apps/desktop/src/index";
import { saveProjectFolder } from "../packages/file-adapter-core/src/index";
import { importMediaToProject } from "../packages/project-core/src/index";

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const tempRoot = await mkdtemp(join(tmpdir(), "paracut-desktop-runtime-"));
const sourceProjectFolder = join(tempRoot, "source-project");
const saveAsProjectFolder = join(tempRoot, "save-as-project");

try {
  const sampleProject = createDesktopSampleProject();
  await saveProjectFolder(sampleProject, sourceProjectFolder);

  let runtime = createDesktopRuntimeState();
  expectEqual(runtime.runtime_version, "0.7.0", "Runtime version should match");
  expectEqual(runtime.shell.shell_version, "0.7.0", "Shell version should match runtime scaffold");
  expectEqual(runtime.shell.project, null, "Fresh runtime should not have a project loaded");

  const opened = await openProjectFolderInDesktopRuntime(
    runtime,
    sourceProjectFolder,
    "2026-06-19T13:00:00.000Z",
  );
  runtime = opened.runtime;

  expectEqual(runtime.last_command_id, "project.open_folder", "Open command should be tracked");
  expectTrue(Boolean(runtime.shell.project), "Open command should load a project");
  expectTrue(Boolean(runtime.shell.folder), "Open command should attach a folder snapshot");
  expectEqual(runtime.shell.dirty, false, "Opened project should be clean");
  expectEqual(runtime.shell.last_loaded_at, "2026-06-19T13:00:00.000Z", "Open timestamp should be preserved");

  const openSummary = getDesktopShellProjectSummary(runtime.shell);
  if (!openSummary) throw new Error("Runtime-opened project should expose a summary");
  expectEqual(openSummary.project_id, "desktop_sample_project", "Runtime should open the sample project");
  expectEqual(openSummary.receipts, 7, "Runtime-opened project should preserve receipt count");

  const saveCommand = buildDesktopCommandList(runtime.shell).find(
    (command) => command.command_id === "project.save",
  );
  if (!saveCommand) throw new Error("Command list missing project.save");
  expectEqual(saveCommand.enabled, true, "Save command should be enabled after opening a folder");

  const loadedProject = getLoadedDesktopRuntimeProject(runtime);
  const mutatedProject = importMediaToProject(loadedProject, {
    asset_id: "asset_runtime_extra_audio",
    kind: "audio",
    name: "runtime-extra-audio.wav",
    uri: "file:///sample/runtime-extra-audio.wav",
    duration_seconds: 3,
    rights_note: "Runtime smoke-test media reference.",
  });

  runtime = replaceDesktopRuntimeProject(runtime, mutatedProject, "Runtime smoke test imported media.");
  expectEqual(runtime.last_command_id, "project.replace_in_memory", "Replace command should be tracked");
  expectEqual(runtime.shell.dirty, true, "Runtime replacement should mark shell dirty");
  expectEqual(runtime.shell.status_message, "Runtime smoke test imported media.", "Runtime status should describe the mutation");

  const saved = await saveDesktopRuntimeProject(runtime, "2026-06-19T13:01:00.000Z");
  runtime = saved.runtime;
  expectEqual(runtime.last_command_id, "project.save", "Save command should be tracked");
  expectEqual(runtime.shell.dirty, false, "Saved runtime project should be clean");
  expectEqual(runtime.shell.last_saved_at, "2026-06-19T13:01:00.000Z", "Save timestamp should be preserved");
  expectEqual(saved.folder?.manifest.counts.media_assets, 2, "Saved folder manifest should reflect imported media");

  const savedAs = await saveDesktopRuntimeProjectAs(
    runtime,
    saveAsProjectFolder,
    "2026-06-19T13:02:00.000Z",
  );
  runtime = savedAs.runtime;
  expectEqual(runtime.last_command_id, "project.save_as", "Save-as command should be tracked");
  expectEqual(runtime.shell.folder?.paths.root_dir, savedAs.folder?.paths.root_dir, "Save-as should attach the new folder");
  expectEqual(savedAs.folder?.manifest.counts.media_assets, 2, "Save-as manifest should preserve imported media");

  console.log("ParaCut desktop runtime smoke test passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
