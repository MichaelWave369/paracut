import {
  loadProjectFolder,
  saveProjectFolder,
  type ProjectFolderSnapshot,
} from "../../../packages/file-adapter-core/src/index";
import type { ParaCutProject } from "../../../packages/project-core/src/index";
import {
  addRecentProjectFolder,
  createDefaultAppSettings,
  loadOrCreateAppSettings,
  writeAppSettingsFile,
  type AppSettings,
} from "../../../packages/settings-core/src/index";

import {
  attachProjectToDesktopShell,
  createDesktopShellState,
  markDesktopShellDirty,
  markDesktopShellSaved,
  type DesktopShellState,
} from "./shell";

export interface DesktopRuntimeState {
  shell: DesktopShellState;
  settings: AppSettings;
  runtime_version: "0.8.0";
  last_command_id: DesktopRuntimeCommandId | null;
}

export type DesktopRuntimeCommandId =
  | "runtime.create"
  | "project.open_folder"
  | "project.save"
  | "project.save_as"
  | "project.replace_in_memory"
  | "settings.load"
  | "settings.save"
  | "settings.replace_in_memory";

export interface DesktopRuntimeResult {
  runtime: DesktopRuntimeState;
  folder: ProjectFolderSnapshot | null;
}

export interface DesktopSettingsResult {
  runtime: DesktopRuntimeState;
  settings_path: string | null;
}

export function createDesktopRuntimeState(
  shell = createDesktopShellState(),
  settings = createDefaultAppSettings(),
): DesktopRuntimeState {
  return {
    shell,
    settings,
    runtime_version: "0.8.0",
    last_command_id: "runtime.create",
  };
}

export async function openProjectFolderInDesktopRuntime(
  runtime: DesktopRuntimeState,
  rootDir: string,
  openedAt = new Date().toISOString(),
): Promise<DesktopRuntimeResult> {
  const folder = await loadProjectFolder(rootDir);
  const settings = addRecentProjectFolder(
    runtime.settings,
    {
      project_id: folder.project.project_id,
      name: folder.project.name,
      root_dir: folder.paths.root_dir,
      opened_at: openedAt,
    },
    openedAt,
  );

  return {
    runtime: {
      ...runtime,
      settings,
      shell: attachProjectToDesktopShell(runtime.shell, folder.project, folder, openedAt),
      last_command_id: "project.open_folder",
    },
    folder,
  };
}

export async function saveDesktopRuntimeProject(
  runtime: DesktopRuntimeState,
  savedAt = new Date().toISOString(),
): Promise<DesktopRuntimeResult> {
  const { project, folder } = runtime.shell;

  if (!project) {
    throw new Error("Cannot save ParaCut desktop runtime: no project is loaded.");
  }
  if (!folder) {
    throw new Error("Cannot save ParaCut desktop runtime: no project folder is attached.");
  }

  const savedFolder = await saveProjectFolder(project, folder.paths.root_dir);

  return {
    runtime: {
      ...runtime,
      shell: markDesktopShellSaved(runtime.shell, savedFolder, savedAt),
      last_command_id: "project.save",
    },
    folder: savedFolder,
  };
}

export async function saveDesktopRuntimeProjectAs(
  runtime: DesktopRuntimeState,
  rootDir: string,
  savedAt = new Date().toISOString(),
): Promise<DesktopRuntimeResult> {
  const { project } = runtime.shell;

  if (!project) {
    throw new Error("Cannot save ParaCut desktop runtime as a folder: no project is loaded.");
  }

  const savedFolder = await saveProjectFolder(project, rootDir);
  const settings = addRecentProjectFolder(
    runtime.settings,
    {
      project_id: savedFolder.project.project_id,
      name: savedFolder.project.name,
      root_dir: savedFolder.paths.root_dir,
      opened_at: savedAt,
    },
    savedAt,
  );

  return {
    runtime: {
      ...runtime,
      settings,
      shell: markDesktopShellSaved(runtime.shell, savedFolder, savedAt),
      last_command_id: "project.save_as",
    },
    folder: savedFolder,
  };
}

export function replaceDesktopRuntimeProject(
  runtime: DesktopRuntimeState,
  project: ParaCutProject,
  statusMessage = "Project updated in desktop runtime.",
): DesktopRuntimeState {
  return {
    ...runtime,
    shell: markDesktopShellDirty(
      {
        ...runtime.shell,
        project,
      },
      statusMessage,
    ),
    last_command_id: "project.replace_in_memory",
  };
}

export async function loadDesktopRuntimeSettings(
  runtime: DesktopRuntimeState,
  settingsRootDir: string,
): Promise<DesktopSettingsResult> {
  const settings = await loadOrCreateAppSettings(settingsRootDir);
  return {
    runtime: {
      ...runtime,
      settings,
      last_command_id: "settings.load",
    },
    settings_path: null,
  };
}

export async function saveDesktopRuntimeSettings(
  runtime: DesktopRuntimeState,
  settingsRootDir: string,
): Promise<DesktopSettingsResult> {
  const settingsPath = await writeAppSettingsFile(runtime.settings, settingsRootDir);
  return {
    runtime: {
      ...runtime,
      last_command_id: "settings.save",
    },
    settings_path: settingsPath,
  };
}

export function replaceDesktopRuntimeSettings(
  runtime: DesktopRuntimeState,
  settings: AppSettings,
): DesktopRuntimeState {
  return {
    ...runtime,
    settings,
    last_command_id: "settings.replace_in_memory",
  };
}

export function getLoadedDesktopRuntimeProject(runtime: DesktopRuntimeState): ParaCutProject {
  const { project } = runtime.shell;
  if (!project) throw new Error("No ParaCut project is loaded in the desktop runtime.");
  return project;
}
