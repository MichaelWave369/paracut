import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type SettingsPanel = "media" | "timeline" | "inspector" | "receipts" | "render";

export interface RecentProjectFolder {
  project_id: string;
  name: string;
  root_dir: string;
  opened_at: string;
}

export interface AppSettings {
  settings_version: "0.8.0";
  default_panel: SettingsPanel;
  default_export_preset_id: string;
  autosave_enabled: boolean;
  max_recent_projects: number;
  recent_projects: RecentProjectFolder[];
  created_at: string;
  updated_at: string;
}

export interface CreateAppSettingsInput {
  default_panel?: SettingsPanel;
  default_export_preset_id?: string;
  autosave_enabled?: boolean;
  max_recent_projects?: number;
  recent_projects?: RecentProjectFolder[];
  created_at?: string;
  updated_at?: string;
}

export interface AddRecentProjectInput {
  project_id: string;
  name: string;
  root_dir: string;
  opened_at?: string;
}

export const SETTINGS_FILE_NAME = "settings.json";
export const DEFAULT_SETTINGS_PANEL: SettingsPanel = "timeline";
export const DEFAULT_EXPORT_PRESET_ID = "preset_vertical_1080x1920";
export const DEFAULT_MAX_RECENT_PROJECTS = 10;

export function createDefaultAppSettings(input: CreateAppSettingsInput = {}): AppSettings {
  const now = input.updated_at ?? input.created_at ?? new Date().toISOString();
  const maxRecentProjects = input.max_recent_projects ?? DEFAULT_MAX_RECENT_PROJECTS;

  const settings: AppSettings = {
    settings_version: "0.8.0",
    default_panel: input.default_panel ?? DEFAULT_SETTINGS_PANEL,
    default_export_preset_id: input.default_export_preset_id ?? DEFAULT_EXPORT_PRESET_ID,
    autosave_enabled: input.autosave_enabled ?? false,
    max_recent_projects: maxRecentProjects,
    recent_projects: clampRecentProjects(input.recent_projects ?? [], maxRecentProjects),
    created_at: input.created_at ?? now,
    updated_at: input.updated_at ?? now,
  };

  validateAppSettings(settings);
  return settings;
}

export function setDefaultSettingsPanel(
  settings: AppSettings,
  panel: SettingsPanel,
  updatedAt = new Date().toISOString(),
): AppSettings {
  assertSettingsPanel(panel);
  return {
    ...settings,
    default_panel: panel,
    updated_at: updatedAt,
  };
}

export function setDefaultExportPresetId(
  settings: AppSettings,
  presetId: string,
  updatedAt = new Date().toISOString(),
): AppSettings {
  if (!presetId) throw new Error("Default export preset id is required.");
  return {
    ...settings,
    default_export_preset_id: presetId,
    updated_at: updatedAt,
  };
}

export function setAutosaveEnabled(
  settings: AppSettings,
  enabled: boolean,
  updatedAt = new Date().toISOString(),
): AppSettings {
  return {
    ...settings,
    autosave_enabled: enabled,
    updated_at: updatedAt,
  };
}

export function addRecentProjectFolder(
  settings: AppSettings,
  input: AddRecentProjectInput,
  updatedAt = input.opened_at ?? new Date().toISOString(),
): AppSettings {
  if (!input.project_id) throw new Error("Recent project requires project_id.");
  if (!input.name) throw new Error("Recent project requires name.");
  if (!input.root_dir) throw new Error("Recent project requires root_dir.");

  const recentProject: RecentProjectFolder = {
    project_id: input.project_id,
    name: input.name,
    root_dir: input.root_dir,
    opened_at: input.opened_at ?? updatedAt,
  };

  const deduped = settings.recent_projects.filter((project) => project.root_dir !== input.root_dir);

  return {
    ...settings,
    recent_projects: clampRecentProjects([recentProject, ...deduped], settings.max_recent_projects),
    updated_at: updatedAt,
  };
}

export function serializeAppSettings(settings: AppSettings): string {
  validateAppSettings(settings);
  return `${JSON.stringify(settings, null, 2)}\n`;
}

export function parseAppSettingsJson(raw: string): AppSettings {
  const parsed: unknown = JSON.parse(raw);
  return normalizeAppSettings(parsed);
}

export function normalizeAppSettings(value: unknown): AppSettings {
  if (!isRecord(value)) throw new Error("ParaCut app settings must be a JSON object.");

  const now = typeof value.updated_at === "string" ? value.updated_at : new Date().toISOString();
  const maxRecentProjects = typeof value.max_recent_projects === "number"
    ? value.max_recent_projects
    : DEFAULT_MAX_RECENT_PROJECTS;

  const settings = createDefaultAppSettings({
    default_panel: isSettingsPanel(value.default_panel) ? value.default_panel : DEFAULT_SETTINGS_PANEL,
    default_export_preset_id: typeof value.default_export_preset_id === "string" && value.default_export_preset_id.length > 0
      ? value.default_export_preset_id
      : DEFAULT_EXPORT_PRESET_ID,
    autosave_enabled: typeof value.autosave_enabled === "boolean" ? value.autosave_enabled : false,
    max_recent_projects: maxRecentProjects,
    recent_projects: Array.isArray(value.recent_projects)
      ? value.recent_projects.filter(isRecentProjectFolder)
      : [],
    created_at: typeof value.created_at === "string" ? value.created_at : now,
    updated_at: now,
  });

  return settings;
}

export function resolveSettingsFilePath(settingsRootDir: string): string {
  if (!settingsRootDir) throw new Error("Settings root directory is required.");
  return join(settingsRootDir, SETTINGS_FILE_NAME);
}

export async function writeAppSettingsFile(settings: AppSettings, settingsRootDir: string): Promise<string> {
  const settingsPath = resolveSettingsFilePath(settingsRootDir);
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, serializeAppSettings(settings), "utf-8");
  return settingsPath;
}

export async function readAppSettingsFile(settingsRootDir: string): Promise<AppSettings> {
  const raw = await readFile(resolveSettingsFilePath(settingsRootDir), "utf-8");
  return parseAppSettingsJson(raw);
}

export async function loadOrCreateAppSettings(
  settingsRootDir: string,
  input: CreateAppSettingsInput = {},
): Promise<AppSettings> {
  try {
    return await readAppSettingsFile(settingsRootDir);
  } catch (error) {
    if (!isNodeFileNotFoundError(error)) throw error;
    const settings = createDefaultAppSettings(input);
    await writeAppSettingsFile(settings, settingsRootDir);
    return settings;
  }
}

export function validateAppSettings(settings: AppSettings): void {
  if (settings.settings_version !== "0.8.0") {
    throw new Error(`Unsupported ParaCut settings version: ${settings.settings_version}`);
  }
  assertSettingsPanel(settings.default_panel);
  if (!settings.default_export_preset_id) throw new Error("Default export preset id is required.");
  if (!Number.isInteger(settings.max_recent_projects) || settings.max_recent_projects < 1) {
    throw new Error("max_recent_projects must be a positive integer.");
  }
  if (settings.recent_projects.length > settings.max_recent_projects) {
    throw new Error("recent_projects exceeds max_recent_projects.");
  }
  for (const recentProject of settings.recent_projects) {
    validateRecentProjectFolder(recentProject);
  }
  if (!settings.created_at) throw new Error("Settings created_at is required.");
  if (!settings.updated_at) throw new Error("Settings updated_at is required.");
}

function clampRecentProjects(projects: RecentProjectFolder[], maxRecentProjects: number): RecentProjectFolder[] {
  return projects.slice(0, maxRecentProjects);
}

function assertSettingsPanel(panel: SettingsPanel): void {
  if (!isSettingsPanel(panel)) throw new Error(`Unsupported settings panel: ${String(panel)}`);
}

function isSettingsPanel(value: unknown): value is SettingsPanel {
  return value === "media" || value === "timeline" || value === "inspector" || value === "receipts" || value === "render";
}

function isRecentProjectFolder(value: unknown): value is RecentProjectFolder {
  if (!isRecord(value)) return false;
  return (
    typeof value.project_id === "string" &&
    typeof value.name === "string" &&
    typeof value.root_dir === "string" &&
    typeof value.opened_at === "string"
  );
}

function validateRecentProjectFolder(project: RecentProjectFolder): void {
  if (!project.project_id) throw new Error("Recent project project_id is required.");
  if (!project.name) throw new Error("Recent project name is required.");
  if (!project.root_dir) throw new Error("Recent project root_dir is required.");
  if (!project.opened_at) throw new Error("Recent project opened_at is required.");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeFileNotFoundError(error: unknown): boolean {
  return isRecord(error) && error.code === "ENOENT";
}
