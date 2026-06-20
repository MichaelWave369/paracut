import {
  loadProjectFolder,
  saveProjectFolder,
  type ProjectFolderSnapshot,
} from "../../../packages/file-adapter-core/src/index";
import type { ParaCutProject } from "../../../packages/project-core/src/index";

import {
  attachProjectToDesktopShell,
  createDesktopShellState,
  markDesktopShellDirty,
  markDesktopShellSaved,
  type DesktopShellState,
} from "./shell";

export interface DesktopRuntimeState {
  shell: DesktopShellState;
  runtime_version: "0.7.0";
  last_command_id: DesktopRuntimeCommandId | null;
}

export type DesktopRuntimeCommandId =
  | "runtime.create"
  | "project.open_folder"
  | "project.save"
  | "project.save_as"
  | "project.replace_in_memory";

export interface DesktopRuntimeResult {
  runtime: DesktopRuntimeState;
  folder: ProjectFolderSnapshot | null;
}

export function createDesktopRuntimeState(shell = createDesktopShellState()): DesktopRuntimeState {
  return {
    shell,
    runtime_version: "0.7.0",
    last_command_id: "runtime.create",
  };
}

export async function openProjectFolderInDesktopRuntime(
  runtime: DesktopRuntimeState,
  rootDir: string,
  openedAt = new Date().toISOString(),
): Promise<DesktopRuntimeResult> {
  const folder = await loadProjectFolder(rootDir);

  return {
    runtime: {
      ...runtime,
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

  return {
    runtime: {
      ...runtime,
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

export function getLoadedDesktopRuntimeProject(runtime: DesktopRuntimeState): ParaCutProject {
  const { project } = runtime.shell;
  if (!project) throw new Error("No ParaCut project is loaded in the desktop runtime.");
  return project;
}
