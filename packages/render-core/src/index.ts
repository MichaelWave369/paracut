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

export function createRenderJob(input: CreateRenderJobInput): RenderJob {
  if (!input.job_id) throw new Error("Render job requires job_id");
  if (!input.project_id) throw new Error("Render job requires project_id");
  if (!input.output_uri) throw new Error("Render job requires output_uri");

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
