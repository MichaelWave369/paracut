import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import type { LedgerReceipt } from "../../ledger-core/src/index";
import {
  parseProject,
  parseProjectReceipts,
  serializeProject,
  serializeProjectReceipts,
  type ParaCutProject,
} from "../../project-core/src/index";

export const PARACUT_FOLDER_SCHEMA_VERSION = "paracut.folder.v0" as const;
export const PROJECT_FILE_NAME = "project.json" as const;
export const RECEIPTS_FILE_NAME = "receipts.jsonl" as const;
export const MANIFEST_FILE_NAME = "manifest.json" as const;

export interface ProjectFolderPaths {
  root_dir: string;
  project_path: string;
  receipts_path: string;
  manifest_path: string;
}

export interface ProjectFolderManifest {
  schema_version: typeof PARACUT_FOLDER_SCHEMA_VERSION;
  project_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  files: {
    project: typeof PROJECT_FILE_NAME;
    receipts: typeof RECEIPTS_FILE_NAME;
    manifest: typeof MANIFEST_FILE_NAME;
  };
  counts: {
    receipts: number;
    media_assets: number;
    tracks: number;
    render_jobs: number;
  };
}

export interface ProjectFolderSnapshot {
  paths: ProjectFolderPaths;
  manifest: ProjectFolderManifest;
  project: ParaCutProject;
  receipts: LedgerReceipt[];
}

export function getProjectFolderPaths(rootDir: string): ProjectFolderPaths {
  const root = resolve(rootDir);
  return {
    root_dir: root,
    project_path: join(root, PROJECT_FILE_NAME),
    receipts_path: join(root, RECEIPTS_FILE_NAME),
    manifest_path: join(root, MANIFEST_FILE_NAME),
  };
}

export function createProjectFolderManifest(project: ParaCutProject): ProjectFolderManifest {
  return {
    schema_version: PARACUT_FOLDER_SCHEMA_VERSION,
    project_id: project.project_id,
    name: project.name,
    created_at: project.created_at,
    updated_at: project.updated_at,
    files: {
      project: PROJECT_FILE_NAME,
      receipts: RECEIPTS_FILE_NAME,
      manifest: MANIFEST_FILE_NAME,
    },
    counts: {
      receipts: project.ledger.length,
      media_assets: project.media.assets.length,
      tracks: project.timeline.tracks.length,
      render_jobs: project.render_jobs.length,
    },
  };
}

export function serializeProjectFolderManifest(manifest: ProjectFolderManifest): string {
  assertProjectFolderManifest(manifest);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function parseProjectFolderManifest(json: string): ProjectFolderManifest {
  const parsed = JSON.parse(json) as unknown;
  assertProjectFolderManifest(parsed);
  return parsed;
}

export async function saveProjectFolder(
  project: ParaCutProject,
  rootDir: string,
): Promise<ProjectFolderSnapshot> {
  const paths = getProjectFolderPaths(rootDir);
  const manifest = createProjectFolderManifest(project);
  const receipts = project.ledger;

  await mkdir(paths.root_dir, { recursive: true });
  await writeFile(paths.project_path, serializeProject(project), "utf8");
  await writeFile(paths.receipts_path, serializeProjectReceipts(project), "utf8");
  await writeFile(paths.manifest_path, serializeProjectFolderManifest(manifest), "utf8");

  return {
    paths,
    manifest,
    project,
    receipts,
  };
}

export async function loadProjectFolder(rootDir: string): Promise<ProjectFolderSnapshot> {
  const paths = getProjectFolderPaths(rootDir);
  const [projectJson, receiptsJsonl, manifestJson] = await Promise.all([
    readFile(paths.project_path, "utf8"),
    readFile(paths.receipts_path, "utf8"),
    readFile(paths.manifest_path, "utf8"),
  ]);

  const project = parseProject(projectJson);
  const receipts = parseProjectReceipts(receiptsJsonl);
  const manifest = parseProjectFolderManifest(manifestJson);

  assertManifestMatchesProject(manifest, project, receipts);
  assertReceiptLogMatchesProject(project, receipts);

  return {
    paths,
    manifest,
    project: {
      ...project,
      ledger: receipts,
    },
    receipts,
  };
}

export function assertProjectFolderManifest(value: unknown): asserts value is ProjectFolderManifest {
  const candidate = value as Partial<ProjectFolderManifest>;
  if (candidate.schema_version !== PARACUT_FOLDER_SCHEMA_VERSION) {
    throw new Error("Unsupported ParaCut folder schema version");
  }
  if (!candidate.project_id) throw new Error("Folder manifest missing project_id");
  if (!candidate.name) throw new Error("Folder manifest missing name");
  if (!candidate.created_at) throw new Error("Folder manifest missing created_at");
  if (!candidate.updated_at) throw new Error("Folder manifest missing updated_at");
  if (!candidate.files) throw new Error("Folder manifest missing files");
  if (candidate.files.project !== PROJECT_FILE_NAME) throw new Error("Folder manifest project file mismatch");
  if (candidate.files.receipts !== RECEIPTS_FILE_NAME) throw new Error("Folder manifest receipts file mismatch");
  if (candidate.files.manifest !== MANIFEST_FILE_NAME) throw new Error("Folder manifest file mismatch");
  if (!candidate.counts) throw new Error("Folder manifest missing counts");
  if (typeof candidate.counts.receipts !== "number") throw new Error("Folder manifest receipt count invalid");
  if (typeof candidate.counts.media_assets !== "number") throw new Error("Folder manifest media count invalid");
  if (typeof candidate.counts.tracks !== "number") throw new Error("Folder manifest track count invalid");
  if (typeof candidate.counts.render_jobs !== "number") throw new Error("Folder manifest render job count invalid");
}

function assertManifestMatchesProject(
  manifest: ProjectFolderManifest,
  project: ParaCutProject,
  receipts: readonly LedgerReceipt[],
): void {
  if (manifest.project_id !== project.project_id) {
    throw new Error("Folder manifest project_id does not match project.json");
  }
  if (manifest.name !== project.name) {
    throw new Error("Folder manifest name does not match project.json");
  }
  if (manifest.counts.receipts !== receipts.length) {
    throw new Error("Folder manifest receipt count does not match receipts.jsonl");
  }
  if (manifest.counts.media_assets !== project.media.assets.length) {
    throw new Error("Folder manifest media count does not match project.json");
  }
  if (manifest.counts.tracks !== project.timeline.tracks.length) {
    throw new Error("Folder manifest track count does not match project.json");
  }
  if (manifest.counts.render_jobs !== project.render_jobs.length) {
    throw new Error("Folder manifest render job count does not match project.json");
  }
}

function assertReceiptLogMatchesProject(project: ParaCutProject, receipts: readonly LedgerReceipt[]): void {
  if (project.ledger.length !== receipts.length) {
    throw new Error("Project JSON ledger and receipt log diverged");
  }

  for (const receipt of receipts) {
    if (receipt.project_id !== project.project_id) {
      throw new Error(`Receipt ${receipt.event_id} belongs to a different project`);
    }
  }
}
