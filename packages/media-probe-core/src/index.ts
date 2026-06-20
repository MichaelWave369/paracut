import { appendReceipt, createReceipt } from "../../ledger-core/src/index";
import { type MediaAsset, type MediaMetadata } from "../../media-core/src/index";
import { getProjectMedia, type ParaCutProject } from "../../project-core/src/index";

export type MediaProbeSource = "manual" | "mock" | "ffprobe" | "sidecar";
export type MediaProbeStatus = "probed" | "failed" | "skipped";

export interface ContainerProbeMetadata {
  format_name?: string;
  duration_seconds?: number;
  bitrate?: number;
  size_bytes?: number;
}

export interface VideoProbeMetadata {
  codec?: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
}

export interface AudioProbeMetadata {
  codec?: string;
  sample_rate?: number;
  channels?: number;
  bitrate?: number;
}

export interface MediaProbeStream {
  stream_index: number;
  stream_type: "video" | "audio" | "subtitle" | "data" | "unknown";
  codec?: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
  fps?: number;
  sample_rate?: number;
  channels?: number;
  bitrate?: number;
}

export interface MediaProbeMetadata {
  container?: ContainerProbeMetadata;
  video?: VideoProbeMetadata;
  audio?: AudioProbeMetadata;
  streams: MediaProbeStream[];
}

export interface CreateMediaProbeResultInput {
  asset_id: string;
  source_uri: string;
  project_id?: string;
  probe_id?: string;
  source?: MediaProbeSource;
  status?: MediaProbeStatus;
  probed_at?: string;
  metadata?: MediaProbeMetadata;
  container?: ContainerProbeMetadata;
  video?: VideoProbeMetadata;
  audio?: AudioProbeMetadata;
  streams?: MediaProbeStream[];
  warnings?: string[];
  errors?: string[];
}

export interface CreateProbeForAssetInput extends Omit<CreateMediaProbeResultInput, "asset_id" | "source_uri"> {}

export interface MediaProbeResult {
  probe_id: string;
  asset_id: string;
  project_id?: string;
  source_uri: string;
  source: MediaProbeSource;
  status: MediaProbeStatus;
  probed_at: string;
  metadata?: MediaProbeMetadata;
  warnings: string[];
  errors: string[];
}

export interface ApplyMediaProbeResult {
  project: ParaCutProject;
  result: MediaProbeResult;
}

export function createMediaProbeResult(input: CreateMediaProbeResultInput): MediaProbeResult {
  if (!input.asset_id) throw new Error("Media probe requires asset_id");
  if (!input.source_uri) throw new Error("Media probe requires source_uri");

  const errors = input.errors ?? [];
  const status = input.status ?? (errors.length > 0 ? "failed" : "probed");
  const metadata = input.metadata ?? buildMetadataFromInput(input);
  const warnings = buildProbeWarnings(status, metadata, input.warnings ?? []);

  validateMetadata(metadata);

  const base: MediaProbeResult = {
    probe_id: input.probe_id ?? createProbeId(),
    asset_id: input.asset_id,
    source_uri: input.source_uri,
    source: input.source ?? "manual",
    status,
    probed_at: input.probed_at ?? new Date().toISOString(),
    warnings,
    errors,
  };

  if (input.project_id !== undefined) base.project_id = input.project_id;
  if (metadata !== undefined) base.metadata = metadata;

  return base;
}

export function createMediaProbeForAsset(
  asset: MediaAsset,
  input: CreateProbeForAssetInput = {},
): MediaProbeResult {
  return createMediaProbeResult({
    ...input,
    asset_id: asset.asset_id,
    source_uri: asset.uri,
  });
}

export function applyMediaProbeResultToProject(
  project: ParaCutProject,
  result: MediaProbeResult,
): ApplyMediaProbeResult {
  if (result.project_id !== undefined && result.project_id !== project.project_id) {
    throw new Error(`Probe project_id ${result.project_id} does not match project ${project.project_id}`);
  }

  const asset = getProjectMedia(project, result.asset_id);
  if (!asset) throw new Error(`Media asset not found for probe: ${result.asset_id}`);

  const updatedAsset = result.status === "probed" && result.metadata
    ? applyProbeMetadataToAsset(asset, result.metadata)
    : asset;

  const nextProject: ParaCutProject = {
    ...project,
    updated_at: result.probed_at,
    media: {
      assets: project.media.assets.map((candidate) => (
        candidate.asset_id === updatedAsset.asset_id ? updatedAsset : candidate
      )),
    },
    ledger: appendReceipt(project.ledger, createMediaProbeReceipt(project.project_id, result)),
  };

  return { project: nextProject, result };
}

export function applyProbeMetadataToAsset(asset: MediaAsset, metadata: MediaProbeMetadata): MediaAsset {
  const duration = pickDurationSeconds(metadata);
  const mediaMetadata = toMediaMetadata(asset.metadata, metadata);
  const next: MediaAsset = {
    ...asset,
    metadata: mediaMetadata,
  };

  if (duration !== undefined) next.duration_seconds = duration;

  return next;
}

export function toMediaMetadata(
  existing: MediaMetadata | undefined,
  probe: MediaProbeMetadata,
): MediaMetadata {
  const next: MediaMetadata = { ...(existing ?? {}) };

  if (probe.video?.width !== undefined) next.width = probe.video.width;
  if (probe.video?.height !== undefined) next.height = probe.video.height;
  if (probe.video?.fps !== undefined) next.fps = probe.video.fps;
  if (probe.video?.codec !== undefined) next.codec = probe.video.codec;
  if (probe.audio?.codec !== undefined && next.codec === undefined) next.codec = probe.audio.codec;
  if (probe.audio?.sample_rate !== undefined) next.sample_rate = probe.audio.sample_rate;
  if (probe.audio?.channels !== undefined) next.channels = probe.audio.channels;
  if (probe.video?.bitrate !== undefined) next.bitrate = probe.video.bitrate;
  if (probe.audio?.bitrate !== undefined && next.bitrate === undefined) next.bitrate = probe.audio.bitrate;
  if (probe.container?.bitrate !== undefined && next.bitrate === undefined) next.bitrate = probe.container.bitrate;

  return next;
}

export function pickDurationSeconds(metadata: MediaProbeMetadata): number | undefined {
  if (metadata.container?.duration_seconds !== undefined) return metadata.container.duration_seconds;

  const durations = metadata.streams
    .map((stream) => stream.duration_seconds)
    .filter((duration): duration is number => duration !== undefined);

  if (durations.length === 0) return undefined;
  return Math.max(...durations);
}

function createMediaProbeReceipt(projectId: string, result: MediaProbeResult) {
  return createReceipt({
    type: result.status === "probed" ? "media.probe.completed" : `media.probe.${result.status}`,
    project_id: projectId,
    source: "system",
    approved_by: "system",
    created_at: result.probed_at,
    payload: {
      probe_id: result.probe_id,
      asset_id: result.asset_id,
      source_uri: result.source_uri,
      probe_source: result.source,
      status: result.status,
      duration_seconds: result.metadata ? pickDurationSeconds(result.metadata) ?? null : null,
      has_video: Boolean(result.metadata?.video),
      has_audio: Boolean(result.metadata?.audio),
      stream_count: result.metadata?.streams.length ?? 0,
      warning_count: result.warnings.length,
      error_count: result.errors.length,
      warnings: result.warnings,
      errors: result.errors,
    },
  });
}

function buildMetadataFromInput(input: CreateMediaProbeResultInput): MediaProbeMetadata | undefined {
  if (!input.container && !input.video && !input.audio && !input.streams) return undefined;

  const metadata: MediaProbeMetadata = {
    streams: input.streams ?? buildStreamsFromFlatMetadata(input.video, input.audio),
  };

  if (input.container !== undefined) metadata.container = input.container;
  if (input.video !== undefined) metadata.video = input.video;
  if (input.audio !== undefined) metadata.audio = input.audio;

  return metadata;
}

function buildStreamsFromFlatMetadata(
  video: VideoProbeMetadata | undefined,
  audio: AudioProbeMetadata | undefined,
): MediaProbeStream[] {
  const streams: MediaProbeStream[] = [];

  if (video) {
    streams.push({
      stream_index: streams.length,
      stream_type: "video",
      ...(video.codec !== undefined ? { codec: video.codec } : {}),
      ...(video.width !== undefined ? { width: video.width } : {}),
      ...(video.height !== undefined ? { height: video.height } : {}),
      ...(video.fps !== undefined ? { fps: video.fps } : {}),
      ...(video.bitrate !== undefined ? { bitrate: video.bitrate } : {}),
    });
  }

  if (audio) {
    streams.push({
      stream_index: streams.length,
      stream_type: "audio",
      ...(audio.codec !== undefined ? { codec: audio.codec } : {}),
      ...(audio.sample_rate !== undefined ? { sample_rate: audio.sample_rate } : {}),
      ...(audio.channels !== undefined ? { channels: audio.channels } : {}),
      ...(audio.bitrate !== undefined ? { bitrate: audio.bitrate } : {}),
    });
  }

  return streams;
}

function buildProbeWarnings(
  status: MediaProbeStatus,
  metadata: MediaProbeMetadata | undefined,
  inputWarnings: string[],
): string[] {
  const warnings = [...inputWarnings];

  if (status === "probed" && metadata === undefined) {
    warnings.push("Probe completed without metadata; asset was not enriched.");
  }

  if (metadata && pickDurationSeconds(metadata) === undefined) {
    warnings.push("Probe metadata does not include duration_seconds.");
  }

  return warnings;
}

function validateMetadata(metadata: MediaProbeMetadata | undefined): void {
  if (!metadata) return;

  validateNumber(metadata.container?.duration_seconds, "container.duration_seconds");
  validateNumber(metadata.container?.bitrate, "container.bitrate");
  validateNumber(metadata.container?.size_bytes, "container.size_bytes");
  validateNumber(metadata.video?.width, "video.width");
  validateNumber(metadata.video?.height, "video.height");
  validateNumber(metadata.video?.fps, "video.fps");
  validateNumber(metadata.video?.bitrate, "video.bitrate");
  validateNumber(metadata.audio?.sample_rate, "audio.sample_rate");
  validateNumber(metadata.audio?.channels, "audio.channels");
  validateNumber(metadata.audio?.bitrate, "audio.bitrate");

  for (const stream of metadata.streams) {
    validateNumber(stream.duration_seconds, `stream.${stream.stream_index}.duration_seconds`);
    validateNumber(stream.width, `stream.${stream.stream_index}.width`);
    validateNumber(stream.height, `stream.${stream.stream_index}.height`);
    validateNumber(stream.fps, `stream.${stream.stream_index}.fps`);
    validateNumber(stream.sample_rate, `stream.${stream.stream_index}.sample_rate`);
    validateNumber(stream.channels, `stream.${stream.stream_index}.channels`);
    validateNumber(stream.bitrate, `stream.${stream.stream_index}.bitrate`);
  }
}

function validateNumber(value: number | undefined, label: string): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0) throw new Error(`Probe metadata ${label} must be a non-negative finite number`);
}

function createProbeId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `probe_${Date.now().toString(36)}_${random}`;
}
