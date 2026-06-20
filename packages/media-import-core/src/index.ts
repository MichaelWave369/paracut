import { createReceipt, appendReceipt } from "../../ledger-core/src/index";
import { type AssetKind, type ImportMediaInput } from "../../media-core/src/index";
import { importMediaToProject, type ParaCutProject } from "../../project-core/src/index";

export type MediaImportScheme = "file" | "relative" | "http" | "https" | "data" | "unknown";
export type MediaImportCopyPolicy = "reference-only" | "copy-later" | "proxy-later";
export type MediaImportIntent =
  | "timeline-source"
  | "audio-bed"
  | "image-overlay"
  | "subtitle-track"
  | "project-asset";

export interface MediaWorkspaceTargets {
  media_reference_uri: string;
  cache_uri: string;
  proxy_uri?: string;
  thumbnail_uri?: string;
  waveform_uri?: string;
}

export interface CreateMediaImportReferenceInput {
  source_uri: string;
  asset_id?: string;
  kind?: AssetKind;
  name?: string;
  duration_seconds?: number;
  hash?: ImportMediaInput["hash"];
  metadata?: ImportMediaInput["metadata"];
  rights_note?: string;
  imported_at?: string;
  copy_policy?: MediaImportCopyPolicy;
  intent?: MediaImportIntent;
}

export interface CreateMediaImportBatchOptions {
  batch_id?: string;
  project_id?: string;
  created_at?: string;
}

export interface MediaImportReference {
  asset_id: string;
  kind: AssetKind;
  name: string;
  source_uri: string;
  normalized_uri: string;
  scheme: MediaImportScheme;
  is_local_reference: boolean;
  copy_policy: MediaImportCopyPolicy;
  intent: MediaImportIntent;
  rights_note: string;
  workspace_targets: MediaWorkspaceTargets;
  warnings: string[];
  media_input: ImportMediaInput;
}

export interface MediaImportBatch {
  batch_id: string;
  project_id?: string;
  created_at: string;
  items: MediaImportReference[];
  warning_count: number;
}

export interface ApplyMediaImportBatchResult {
  project: ParaCutProject;
  batch: MediaImportBatch;
}

export function createMediaImportReference(input: CreateMediaImportReferenceInput): MediaImportReference {
  const sourceUri = sanitizeSourceUri(input.source_uri);
  const normalizedUri = normalizeReferenceUri(sourceUri);
  const scheme = detectMediaImportScheme(normalizedUri);
  const kind = input.kind ?? inferAssetKind(normalizedUri);

  if (!kind) {
    throw new Error(`Unable to infer media kind for source_uri: ${sourceUri}`);
  }

  const name = input.name ?? inferMediaName(normalizedUri);
  const assetId = input.asset_id ?? createAssetId(name, kind);
  const copyPolicy = input.copy_policy ?? "reference-only";
  const intent = input.intent ?? inferImportIntent(kind);
  const rightsNote = input.rights_note ?? "User imported media. Rights not verified by ParaCut.";
  const importedAt = input.imported_at ?? new Date().toISOString();
  const warnings = buildImportWarnings({
    source_uri: normalizedUri,
    scheme,
    kind,
    duration_seconds: input.duration_seconds,
    copy_policy: copyPolicy,
    rights_note: input.rights_note,
  });

  const mediaInput: ImportMediaInput = {
    asset_id: assetId,
    kind,
    name,
    uri: normalizedUri,
    rights_note: rightsNote,
    imported_at: importedAt,
  };

  if (input.duration_seconds !== undefined) mediaInput.duration_seconds = input.duration_seconds;
  if (input.hash !== undefined) mediaInput.hash = input.hash;
  if (input.metadata !== undefined) mediaInput.metadata = input.metadata;

  return {
    asset_id: assetId,
    kind,
    name,
    source_uri: sourceUri,
    normalized_uri: normalizedUri,
    scheme,
    is_local_reference: scheme === "file" || scheme === "relative",
    copy_policy: copyPolicy,
    intent,
    rights_note: rightsNote,
    workspace_targets: buildWorkspaceTargets(assetId, kind, normalizedUri),
    warnings,
    media_input: mediaInput,
  };
}

export function createMediaImportBatch(
  inputs: CreateMediaImportReferenceInput[],
  options: CreateMediaImportBatchOptions = {},
): MediaImportBatch {
  if (inputs.length === 0) throw new Error("Media import batch requires at least one item");

  const createdAt = options.created_at ?? new Date().toISOString();
  const seenAssetIds = new Set<string>();
  const items = inputs.map((input) => {
    const reference = createMediaImportReference({
      ...input,
      imported_at: input.imported_at ?? createdAt,
    });

    const uniqueAssetId = makeUniqueAssetId(reference.asset_id, seenAssetIds);
    const item = uniqueAssetId === reference.asset_id
      ? reference
      : renameImportReference(reference, uniqueAssetId, `Asset id was renamed from ${reference.asset_id} to avoid a batch duplicate.`);

    seenAssetIds.add(item.asset_id);
    return item;
  });

  const base: MediaImportBatch = {
    batch_id: options.batch_id ?? createBatchId(),
    created_at: createdAt,
    items,
    warning_count: items.reduce((total, item) => total + item.warnings.length, 0),
  };

  if (options.project_id !== undefined) {
    return { ...base, project_id: options.project_id };
  }

  return base;
}

export function applyMediaImportBatchToProject(
  project: ParaCutProject,
  inputs: CreateMediaImportReferenceInput[],
  options: Omit<CreateMediaImportBatchOptions, "project_id"> = {},
): ApplyMediaImportBatchResult {
  const batch = createMediaImportBatch(inputs, {
    ...options,
    project_id: project.project_id,
  });

  let nextProject = project;
  for (const item of batch.items) {
    nextProject = importMediaToProject(nextProject, item.media_input);
  }

  const receipt = createReceipt({
    type: "media.import.batch.created",
    project_id: nextProject.project_id,
    source: "import",
    approved_by: "human",
    created_at: batch.created_at,
    payload: {
      batch_id: batch.batch_id,
      item_count: batch.items.length,
      warning_count: batch.warning_count,
      assets: batch.items.map((item) => ({
        asset_id: item.asset_id,
        kind: item.kind,
        name: item.name,
        source_uri: item.source_uri,
        normalized_uri: item.normalized_uri,
        scheme: item.scheme,
        copy_policy: item.copy_policy,
        intent: item.intent,
        workspace_targets: item.workspace_targets,
        warning_count: item.warnings.length,
      })),
    },
  });

  nextProject = {
    ...nextProject,
    updated_at: batch.created_at,
    ledger: appendReceipt(nextProject.ledger, receipt),
  };

  return { project: nextProject, batch };
}

export function detectMediaImportScheme(uri: string): MediaImportScheme {
  if (/^[a-zA-Z]:[\\/]/.test(uri)) return "file";
  if (uri.startsWith("/") || uri.startsWith("~/")) return "file";
  if (uri.startsWith("./") || uri.startsWith("../")) return "relative";

  const match = uri.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!match) return "relative";

  const scheme = match[1]?.toLowerCase();
  if (scheme === "file" || scheme === "http" || scheme === "https" || scheme === "data") return scheme;
  return "unknown";
}

export function inferAssetKind(uri: string): AssetKind | undefined {
  if (uri.startsWith("data:image/")) return "image";
  if (uri.startsWith("data:audio/")) return "audio";
  if (uri.startsWith("data:video/")) return "video";
  if (uri.startsWith("data:text/vtt") || uri.startsWith("data:application/x-subrip")) return "subtitle";

  const extension = getExtension(uri);
  if (!extension) return undefined;

  if (["mp4", "mov", "mkv", "webm", "avi", "m4v"].includes(extension)) return "video";
  if (["mp3", "wav", "m4a", "aac", "flac", "ogg"].includes(extension)) return "audio";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) return "image";
  if (["srt", "vtt", "ass"].includes(extension)) return "subtitle";
  if (["paracut", "json"].includes(extension)) return "project";

  return undefined;
}

export function inferImportIntent(kind: AssetKind): MediaImportIntent {
  if (kind === "audio") return "audio-bed";
  if (kind === "image") return "image-overlay";
  if (kind === "subtitle") return "subtitle-track";
  if (kind === "project") return "project-asset";
  return "timeline-source";
}

export function createAssetId(name: string, kind: AssetKind): string {
  const baseName = stripExtension(name);
  const slug = baseName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `asset_${slug || kind}`;
}

function sanitizeSourceUri(sourceUri: string): string {
  const trimmed = sourceUri.trim();
  if (!trimmed) throw new Error("Media import source_uri is required");
  if (/[\u0000-\u001f]/.test(trimmed)) throw new Error("Media import source_uri contains control characters");
  return trimmed;
}

function normalizeReferenceUri(sourceUri: string): string {
  return sourceUri.replace(/\\/g, "/");
}

function inferMediaName(uri: string): string {
  if (uri.startsWith("data:")) return "inline-media";

  const clean = stripQueryAndHash(uri).replace(/\\/g, "/");
  const leaf = clean.split("/").filter(Boolean).pop();
  if (!leaf) return "media";

  try {
    return decodeURIComponent(leaf);
  } catch {
    return leaf;
  }
}

function getExtension(uri: string): string | undefined {
  const clean = stripQueryAndHash(uri);
  const leaf = clean.replace(/\\/g, "/").split("/").filter(Boolean).pop();
  if (!leaf) return undefined;

  const lastDot = leaf.lastIndexOf(".");
  if (lastDot < 0 || lastDot === leaf.length - 1) return undefined;
  return leaf.slice(lastDot + 1).toLowerCase();
}

function stripExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return name;
  return name.slice(0, lastDot);
}

function stripQueryAndHash(uri: string): string {
  const queryIndex = uri.search(/[?#]/);
  return queryIndex < 0 ? uri : uri.slice(0, queryIndex);
}

function buildWorkspaceTargets(assetId: string, kind: AssetKind, normalizedUri: string): MediaWorkspaceTargets {
  const targets: MediaWorkspaceTargets = {
    media_reference_uri: normalizedUri,
    cache_uri: `.paracut/cache/${assetId}`,
  };

  if (kind === "video") {
    targets.proxy_uri = `.paracut/proxies/${assetId}.mp4`;
    targets.thumbnail_uri = `.paracut/thumbnails/${assetId}.jpg`;
    targets.waveform_uri = `.paracut/waveforms/${assetId}.json`;
  }

  if (kind === "audio") {
    targets.waveform_uri = `.paracut/waveforms/${assetId}.json`;
  }

  if (kind === "image") {
    targets.thumbnail_uri = `.paracut/thumbnails/${assetId}.jpg`;
  }

  return targets;
}

function buildImportWarnings(input: {
  source_uri: string;
  scheme: MediaImportScheme;
  kind: AssetKind;
  duration_seconds?: number | undefined;
  copy_policy: MediaImportCopyPolicy;
  rights_note?: string | undefined;
}): string[] {
  const warnings: string[] = [];

  if (input.scheme === "http" || input.scheme === "https") {
    warnings.push("Remote media is referenced by URL and may change or become unavailable.");
  }

  if (input.scheme === "unknown") {
    warnings.push("Media source uses an unknown URI scheme.");
  }

  if (input.source_uri.includes("../")) {
    warnings.push("Relative media path contains a parent-directory segment; portability may depend on folder location.");
  }

  if ((input.kind === "video" || input.kind === "audio") && input.duration_seconds === undefined) {
    warnings.push("Timed media is missing duration_seconds; timeline validation may need a later probe step.");
  }

  if (input.copy_policy !== "reference-only") {
    warnings.push("Copy/proxy policies are recorded for future adapters; v0.9 does not duplicate media files.");
  }

  if (!input.rights_note) {
    warnings.push("Rights note was not provided; ParaCut marks rights as unverified.");
  }

  return warnings;
}

function makeUniqueAssetId(assetId: string, seenAssetIds: Set<string>): string {
  if (!seenAssetIds.has(assetId)) return assetId;

  let suffix = 2;
  let candidate = `${assetId}_${suffix}`;
  while (seenAssetIds.has(candidate)) {
    suffix += 1;
    candidate = `${assetId}_${suffix}`;
  }
  return candidate;
}

function renameImportReference(
  reference: MediaImportReference,
  assetId: string,
  warning: string,
): MediaImportReference {
  return {
    ...reference,
    asset_id: assetId,
    warnings: [...reference.warnings, warning],
    workspace_targets: buildWorkspaceTargets(assetId, reference.kind, reference.normalized_uri),
    media_input: {
      ...reference.media_input,
      asset_id: assetId,
    },
  };
}

function createBatchId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `media_batch_${Date.now().toString(36)}_${random}`;
}
