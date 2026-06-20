import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  addRecentProjectFolder,
  createDefaultAppSettings,
  DEFAULT_EXPORT_PRESET_ID,
  loadDesktopRuntimeSettings,
  saveDesktopRuntimeSettings,
  createDesktopRuntimeState,
  replaceDesktopRuntimeSettings,
  setAutosaveEnabled,
  setDefaultExportPresetId,
  setDefaultSettingsPanel,
} from "../apps/desktop/src/index";
import {
  loadOrCreateAppSettings,
  readAppSettingsFile,
  SETTINGS_FILE_NAME,
  writeAppSettingsFile,
} from "../packages/settings-core/src/index";

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const tempRoot = await mkdtemp(join(tmpdir(), "paracut-settings-"));

try {
  const settings = createDefaultAppSettings({
    created_at: "2026-06-19T14:00:00.000Z",
    updated_at: "2026-06-19T14:00:00.000Z",
  });

  expectEqual(settings.settings_version, "0.8.0", "Settings version should match");
  expectEqual(settings.default_panel, "timeline", "Default panel should be timeline");
  expectEqual(settings.default_export_preset_id, DEFAULT_EXPORT_PRESET_ID, "Default export preset should match");
  expectEqual(settings.autosave_enabled, false, "Autosave should default off");

  let updated = setDefaultSettingsPanel(settings, "receipts", "2026-06-19T14:01:00.000Z");
  updated = setDefaultExportPresetId(updated, "preset_wide_1080p", "2026-06-19T14:02:00.000Z");
  updated = setAutosaveEnabled(updated, true, "2026-06-19T14:03:00.000Z");
  updated = addRecentProjectFolder(updated, {
    project_id: "project_settings_smoke",
    name: "Settings Smoke Project",
    root_dir: "/tmp/paracut/settings-smoke-project",
    opened_at: "2026-06-19T14:04:00.000Z",
  });

  expectEqual(updated.default_panel, "receipts", "Default panel should update");
  expectEqual(updated.default_export_preset_id, "preset_wide_1080p", "Default preset should update");
  expectEqual(updated.autosave_enabled, true, "Autosave should update");
  expectEqual(updated.recent_projects.length, 1, "Recent project should be tracked");

  const settingsPath = await writeAppSettingsFile(updated, tempRoot);
  expectTrue(settingsPath.endsWith(SETTINGS_FILE_NAME), "Settings file path should end with settings.json");

  const reloaded = await readAppSettingsFile(tempRoot);
  expectEqual(reloaded.default_panel, "receipts", "Reloaded settings should preserve default panel");
  expectEqual(reloaded.default_export_preset_id, "preset_wide_1080p", "Reloaded settings should preserve default preset");
  expectEqual(reloaded.recent_projects[0]?.project_id, "project_settings_smoke", "Reloaded settings should preserve recents");

  const createdRoot = join(tempRoot, "created-settings-root");
  const created = await loadOrCreateAppSettings(createdRoot, {
    default_panel: "media",
    created_at: "2026-06-19T14:05:00.000Z",
    updated_at: "2026-06-19T14:05:00.000Z",
  });
  expectEqual(created.default_panel, "media", "loadOrCreate should create missing settings with input defaults");

  let runtime = createDesktopRuntimeState();
  runtime = replaceDesktopRuntimeSettings(runtime, reloaded);
  expectEqual(runtime.last_command_id, "settings.replace_in_memory", "Runtime settings replacement should be tracked");

  const runtimeSettingsRoot = join(tempRoot, "runtime-settings-root");
  const savedRuntimeSettings = await saveDesktopRuntimeSettings(runtime, runtimeSettingsRoot);
  runtime = savedRuntimeSettings.runtime;
  expectEqual(runtime.last_command_id, "settings.save", "Runtime settings save should be tracked");
  expectTrue(Boolean(savedRuntimeSettings.settings_path), "Runtime settings save should return a path");

  const loadedRuntimeSettings = await loadDesktopRuntimeSettings(runtime, runtimeSettingsRoot);
  runtime = loadedRuntimeSettings.runtime;
  expectEqual(runtime.last_command_id, "settings.load", "Runtime settings load should be tracked");
  expectEqual(runtime.settings.default_panel, "receipts", "Runtime settings load should restore saved panel");

  console.log("ParaCut settings smoke test passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
