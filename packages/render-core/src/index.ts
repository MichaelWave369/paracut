import { getMediaAsset, type MediaAsset, type MediaLibrary } from "../../media-core/src/index";
import { getTimelineDuration, type TimelineClip, type TimelineState, type TimelineTrack } from "../../timeline-core/src/index";

export type ExportPlatform = "wide" | "vertical" | "square" | "audio" | "custom";
export type RenderStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface ExportPreset {
  preset_id: string;
  name: string;
  platform: ExportPlatform;
  width: number;
  height: number;
  fps: number;
  video_codec: "h264" | "h265" | "av1" | "prores" | "none";
  audio_codec: "aac" | "opus" | "pcm" | "mp3" | "none";
  container: "mp4" | "mov" | "webm" | "wav" | "mp3";
}

export interface RenderJob {
  job_id: string;
  project_id: string;
  timeline_id?: string;
  preset: ExportPreset;
  output_uri: string;
  status: RenderStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface CreateRenderJobInput {
  job_id: string;
  project_id: string;
  timeline_id?: string;
  preset: ExportPreset;
  output_uri: string;
  created_at?: string;
}

export interface RenderPlanInputAsset {
  input_id: string;
  input_index: number;
  asset_id: string;
  uri: string;
  kind: MediaAsset["kind"];
  name: string;
  duration_seconds?: number;
}

export interface RenderPlanClip {
  clip_id: string;
  asset_id: string;
  input_id: string;
  input_index: number;
  track_id: string;
  track_kind: TimelineTrack["kind"];
  timeline_start: number;
  timeline_end: number;
  source_start: number;
  source_end: number;
  enabled: boolean;
}

export interface RenderPlanWarning {
  code: string;
  message: string;
  severity: "info" | "warning";
}

export interface RenderPlan {
  plan_id: string;
  job_id: string;
  project_id: string;
  output_uri: string;
  preset: ExportPreset;
  duration_seconds: number;
  inputs: RenderPlanInputAsset[];
  clips: RenderPlanClip[];
  filter_graph: string[];
  argv: string[];
  warnings: RenderPlanWarning[];
  created_at: string;
}

export function createRenderJob(input: CreateRenderJobInput): RenderJob {
  if (!input.job_id) throw new Error("Render job requires job_id");
  if (!input.project_id) throw new Error("Render job requires project_id");
  if (!input.output_uri) throw new Error("Render job requires output_uri");
  validateExportPreset(input.preset);

  const job: RenderJob = {
    job_id: input.job_id,
    project_id: input.project_id,
    preset: input.preset,
    output_uri: input.output_uri,
    status: "queued",
    created_at: input.created_at ?? new Date().toISOString(),
  };

  if (input.timeline_id !== undefined) job.timeline_id = input.timeline_id;
  return job;
}

export function markRenderRunning(job: RenderJob, startedAt = new Date().toISOString()): RenderJob {
  return {
    ...job,
    status: "running",
    started_at: startedAt,
  };
}

export function markRenderCompleted(job: RenderJob, completedAt = new Date().toISOString()): RenderJob {
  return {
    ...job,
    status: "completed",
    completed_at: completedAt,
  };
}

export function markRenderFailed(job: RenderJob, error: string, completedAt = new Date().toISOString()): RenderJob {
  return {
    ...job,
    status: "failed",
    error,
    completed_at: completedAt,
  };
}

export function createRenderPlan(
  job: RenderJob,
  timeline: TimelineState,
  media: MediaLibrary,
  createdAt = new Date().toISOString(),
): RenderPlan {
  validateExportPreset(job.preset);

  const inputs = collectRenderInputs(timeline, media);
  const clips = collectRenderClips(timeline, inputs);
  const durationSeconds = getTimelineDuration(timeline);
  const warnings = collectRenderWarnings(job, inputs, clips, durationSeconds);
  const filterGraph = buildFilterGraph(job.preset, clips, durationSeconds);
  const argv = buildFfmpegArgv(job, inputs, filterGraph);

  return {
    plan_id: `plan_${job.job_id}`,
    job_id: job.job_id,
    project_id: job.project_id,
    output_uri: job.output_uri,
    preset: job.preset,
    duration_seconds: durationSeconds,
    inputs,
    clips,
    filter_graph: filterGraph,
    argv,
    warnings,
    created_at: createdAt,
  };
}

export function summarizeRenderPlan(plan: RenderPlan): string {
  return [
    `Render plan ${plan.plan_id}`,
    `job=${plan.job_id}`,
    `preset=${plan.preset.name}`,
    `duration=${plan.duration_seconds}s`,
    `inputs=${plan.inputs.length}`,
    `clips=${plan.clips.length}`,
    `warnings=${plan.warnings.length}`,
  ].join(" ");
}

export function renderPlanToCommandPreview(plan: RenderPlan): string {
  return plan.argv.map(quoteArg).join(" ");
}

export const DEFAULT_EXPORT_PRESETS: ExportPreset[] = [
  {
    preset_id: "preset_wide_1080p",
    name: "Wide 1080p",
    platform: "wide",
    width: 1920,
    height: 1080,
    fps: 30,
    video_codec: "h264",
    audio_codec: "aac",
    container: "mp4",
  },
  {
    preset_id: "preset_vertical_1080x1920",
    name: "Vertical 1080x1920",
    platform: "vertical",
    width: 1080,
    height: 1920,
    fps: 30,
    video_codec: "h264",
    audio_codec: "aac",
    container: "mp4",
  },
  {
    preset_id: "preset_square_1080",
    name: "Square 1080x1080",
    platform: "square",
    width: 1080,
    height: 1080,
    fps: 30,
    video_codec: "h264",
    audio_codec: "aac",
    container: "mp4",
  },
  {
    preset_id: "preset_audio_mp3",
    name: "Audio MP3",
    platform: "audio",
    width: 0,
    height: 0,
    fps: 0,
    video_codec: "none",
    audio_codec: "mp3",
    container: "mp3",
  },
];

function collectRenderInputs(timeline: TimelineState, media: MediaLibrary): RenderPlanInputAsset[] {
  const byAssetId = new Map<string, RenderPlanInputAsset>();

  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (!clip.enabled) continue;
      if (byAssetId.has(clip.asset_id)) continue;

      const asset = getMediaAsset(media, clip.asset_id);
      if (!asset) throw new Error(`Cannot build render plan. Missing media asset: ${clip.asset_id}`);

      const inputIndex = byAssetId.size;
      byAssetId.set(asset.asset_id, {
        input_id: `input_${inputIndex}`,
        input_index: inputIndex,
        asset_id: asset.asset_id,
        uri: asset.uri,
        kind: asset.kind,
        name: asset.name,
        ...(asset.duration_seconds !== undefined ? { duration_seconds: asset.duration_seconds } : {}),
      });
    }
  }

  return [...byAssetId.values()];
}

function collectRenderClips(timeline: TimelineState, inputs: RenderPlanInputAsset[]): RenderPlanClip[] {
  const inputByAssetId = new Map(inputs.map((input) => [input.asset_id, input]));
  const clips: RenderPlanClip[] = [];

  for (const track of timeline.tracks) {
    for (const clip of track.clips) {
      if (!clip.enabled) continue;
      const input = inputByAssetId.get(clip.asset_id);
      if (!input) throw new Error(`Cannot build render clip. Missing input for asset: ${clip.asset_id}`);
      clips.push(toRenderPlanClip(clip, track, input));
    }
  }

  return clips.sort((a, b) => a.timeline_start - b.timeline_start || a.track_id.localeCompare(b.track_id));
}

function toRenderPlanClip(clip: TimelineClip, track: TimelineTrack, input: RenderPlanInputAsset): RenderPlanClip {
  return {
    clip_id: clip.clip_id,
    asset_id: clip.asset_id,
    input_id: input.input_id,
    input_index: input.input_index,
    track_id: track.track_id,
    track_kind: track.kind,
    timeline_start: clip.timeline.start,
    timeline_end: clip.timeline.end,
    source_start: clip.source.start,
    source_end: clip.source.end,
    enabled: clip.enabled,
  };
}

function collectRenderWarnings(
  job: RenderJob,
  inputs: RenderPlanInputAsset[],
  clips: RenderPlanClip[],
  durationSeconds: number,
): RenderPlanWarning[] {
  const warnings: RenderPlanWarning[] = [];
  const hasVisualInput = inputs.some((input) => input.kind === "video" || input.kind === "image");
  const hasAudioInput = inputs.some((input) => input.kind === "audio" || input.kind === "video");
  const hasVisualClip = clips.some((clip) => clip.track_kind === "video" || clip.track_kind === "text" || clip.track_kind === "caption");
  const hasAudioClip = clips.some((clip) => clip.track_kind === "audio");

  if (durationSeconds <= 0) {
    warnings.push({ code: "empty_timeline", message: "Timeline has no renderable duration.", severity: "warning" });
  }

  if (job.preset.video_codec !== "none" && !hasVisualInput && !hasVisualClip) {
    warnings.push({ code: "no_visual_input", message: "Video export has no visual input clips.", severity: "warning" });
  }

  if (job.preset.audio_codec !== "none" && !hasAudioInput && !hasAudioClip) {
    warnings.push({ code: "no_audio_input", message: "Export preset includes audio but no audio-capable input is present.", severity: "info" });
  }

  if (job.preset.container !== inferContainerFromOutput(job.output_uri)) {
    warnings.push({
      code: "container_extension_mismatch",
      message: `Preset container ${job.preset.container} may not match output URI ${job.output_uri}.`,
      severity: "warning",
    });
  }

  return warnings;
}

function buildFilterGraph(preset: ExportPreset, clips: RenderPlanClip[], durationSeconds: number): string[] {
  if (preset.video_codec === "none") {
    return [`audio_timeline_duration=${durationSeconds}`];
  }

  const visualClips = clips.filter((clip) => clip.track_kind !== "audio");
  if (visualClips.length === 0) {
    return [`color=size=${preset.width}x${preset.height}:rate=${preset.fps}:duration=${durationSeconds}[vout]`];
  }

  return visualClips.map((clip, index) => {
    const sourceDuration = clip.source_end - clip.source_start;
    return [
      `[${clip.input_index}:v]`,
      `trim=start=${clip.source_start}:duration=${sourceDuration}`,
      `setpts=PTS-STARTPTS+${clip.timeline_start}/TB`,
      `scale=${preset.width}:${preset.height}:force_original_aspect_ratio=decrease`,
      `pad=${preset.width}:${preset.height}:(ow-iw)/2:(oh-ih)/2`,
      `format=yuv420p`,
      `[v${index}]`,
    ].join("");
  });
}

function buildFfmpegArgv(job: RenderJob, inputs: RenderPlanInputAsset[], filterGraph: string[]): string[] {
  const argv = ["ffmpeg", "-y"];
  for (const input of inputs) {
    argv.push("-i", normalizeFileUri(input.uri));
  }

  if (filterGraph.length > 0) {
    argv.push("-filter_complex", filterGraph.join(";"));
  }

  argv.push(...videoCodecArgs(job.preset), ...audioCodecArgs(job.preset), "-f", job.preset.container, normalizeFileUri(job.output_uri));
  return argv;
}

function videoCodecArgs(preset: ExportPreset): string[] {
  switch (preset.video_codec) {
    case "h264":
      return ["-c:v", "libx264", "-r", String(preset.fps), "-pix_fmt", "yuv420p"];
    case "h265":
      return ["-c:v", "libx265", "-r", String(preset.fps)];
    case "av1":
      return ["-c:v", "libaom-av1", "-r", String(preset.fps)];
    case "prores":
      return ["-c:v", "prores_ks", "-r", String(preset.fps)];
    case "none":
      return ["-vn"];
  }
}

function audioCodecArgs(preset: ExportPreset): string[] {
  switch (preset.audio_codec) {
    case "aac":
      return ["-c:a", "aac", "-b:a", "192k"];
    case "opus":
      return ["-c:a", "libopus", "-b:a", "160k"];
    case "pcm":
      return ["-c:a", "pcm_s16le"];
    case "mp3":
      return ["-c:a", "libmp3lame", "-b:a", "192k"];
    case "none":
      return ["-an"];
  }
}

function validateExportPreset(preset: ExportPreset): void {
  if (!preset.preset_id) throw new Error("Export preset requires preset_id");
  if (!preset.name) throw new Error("Export preset requires name");
  if (preset.video_codec !== "none") {
    if (preset.width <= 0 || preset.height <= 0) throw new Error("Video export preset requires positive dimensions");
    if (preset.fps <= 0) throw new Error("Video export preset requires positive fps");
  }
}

function inferContainerFromOutput(outputUri: string): ExportPreset["container"] | "unknown" {
  const normalized = outputUri.toLowerCase();
  if (normalized.endsWith(".mp4")) return "mp4";
  if (normalized.endsWith(".mov")) return "mov";
  if (normalized.endsWith(".webm")) return "webm";
  if (normalized.endsWith(".wav")) return "wav";
  if (normalized.endsWith(".mp3")) return "mp3";
  return "unknown";
}

function normalizeFileUri(uri: string): string {
  return uri.startsWith("file://") ? uri.slice("file://".length) : uri;
}

function quoteArg(arg: string): string {
  return /^[a-zA-Z0-9_./:=+-]+$/.test(arg) ? arg : JSON.stringify(arg);
}
