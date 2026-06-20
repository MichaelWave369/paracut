import type { ProjectFolderSnapshot } from "../../../packages/file-adapter-core/src/index";
import type { ParaCutProject } from "../../../packages/project-core/src/index";
import { getTimelineDuration } from "../../../packages/timeline-core/src/index";

export type DesktopPanel = "media" | "timeline" | "inspector" | "receipts" | "render";
export type DesktopCommandId =
  | "project.open"
  | "project.save"
  | "media.import"
  | "render.plan"
  | "receipts.view";

export interface DesktopCommand {
  command_id: DesktopCommandId;
  label: string;
  enabled: boolean;
  reason?: string;
}

export interface DesktopProjectSummary {
  project_id: string;
  name: string;
  media_assets: number;
  tracks: number;
  clips: number;
  receipts: number;
  render_jobs: number;
  duration_seconds: number;
}

export interface DesktopShellState {
  app_name: "ParaCut";
  shell_version: "0.7.0";
  active_panel: DesktopPanel;
  project: ParaCutProject | null;
  folder: ProjectFolderSnapshot | null;
  dirty: boolean;
  status_message: string;
  last_loaded_at: string | null;
  last_saved_at: string | null;
}

export const DESKTOP_SHELL_PANELS: DesktopPanel[] = [
  "media",
  "timeline",
  "inspector",
  "receipts",
  "render",
];

export function createDesktopShellState(): DesktopShellState {
  return {
    app_name: "ParaCut",
    shell_version: "0.7.0",
    active_panel: "timeline",
    project: null,
    folder: null,
    dirty: false,
    status_message: "No project loaded.",
    last_loaded_at: null,
    last_saved_at: null,
  };
}

export function attachProjectToDesktopShell(
  state: DesktopShellState,
  project: ParaCutProject,
  folder: ProjectFolderSnapshot | null = null,
  loadedAt = new Date().toISOString(),
): DesktopShellState {
  return {
    ...state,
    project,
    folder,
    dirty: false,
    status_message: folder
      ? `Loaded ${project.name} from ${folder.paths.root_dir}`
      : `Loaded ${project.name} in memory`,
    last_loaded_at: loadedAt,
    last_saved_at: folder ? loadedAt : null,
  };
}

export function setActiveDesktopPanel(state: DesktopShellState, panel: DesktopPanel): DesktopShellState {
  assertDesktopPanel(panel);
  return {
    ...state,
    active_panel: panel,
  };
}

export function markDesktopShellDirty(
  state: DesktopShellState,
  statusMessage = "Project has unsaved changes.",
): DesktopShellState {
  if (!state.project) {
    return {
      ...state,
      status_message: "No project is loaded.",
    };
  }

  return {
    ...state,
    dirty: true,
    status_message: statusMessage,
  };
}

export function markDesktopShellSaved(
  state: DesktopShellState,
  folder: ProjectFolderSnapshot,
  savedAt = new Date().toISOString(),
): DesktopShellState {
  return {
    ...state,
    project: folder.project,
    folder,
    dirty: false,
    status_message: `Saved ${folder.project.name} to ${folder.paths.root_dir}`,
    last_saved_at: savedAt,
  };
}

export function canSaveDesktopProject(state: DesktopShellState): boolean {
  return Boolean(state.project && state.folder);
}

export function getDesktopShellProjectSummary(state: DesktopShellState): DesktopProjectSummary | null {
  if (!state.project) return null;
  return summarizeDesktopProject(state.project);
}

export function summarizeDesktopProject(project: ParaCutProject): DesktopProjectSummary {
  const clips = project.timeline.tracks.reduce((count, track) => count + track.clips.length, 0);

  return {
    project_id: project.project_id,
    name: project.name,
    media_assets: project.media.assets.length,
    tracks: project.timeline.tracks.length,
    clips,
    receipts: project.ledger.length,
    render_jobs: project.render_jobs.length,
    duration_seconds: getTimelineDuration(project.timeline),
  };
}

export function buildDesktopCommandList(state: DesktopShellState): DesktopCommand[] {
  const hasProject = state.project !== null;
  const canSave = canSaveDesktopProject(state);

  return [
    {
      command_id: "project.open",
      label: "Open Project Folder",
      enabled: true,
    },
    {
      command_id: "project.save",
      label: "Save Project Folder",
      enabled: canSave,
      ...(canSave ? {} : { reason: "Load or choose a project folder before saving." }),
    },
    {
      command_id: "media.import",
      label: "Import Media",
      enabled: hasProject,
      ...(hasProject ? {} : { reason: "Open or create a project before importing media." }),
    },
    {
      command_id: "render.plan",
      label: "Plan Render",
      enabled: hasProject,
      ...(hasProject ? {} : { reason: "Open or create a project before planning a render." }),
    },
    {
      command_id: "receipts.view",
      label: "View Receipts",
      enabled: hasProject,
      ...(hasProject ? {} : { reason: "Open or create a project before viewing receipts." }),
    },
  ];
}

function assertDesktopPanel(panel: DesktopPanel): void {
  if (!DESKTOP_SHELL_PANELS.includes(panel)) {
    throw new Error(`Unsupported ParaCut desktop panel: ${panel}`);
  }
}
