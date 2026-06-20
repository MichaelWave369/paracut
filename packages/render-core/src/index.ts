export type ExportPlatform = "wide" | "vertical" | "square" | "audio" | "custom";

export interface ExportPreset {
  preset_id: string;
  name: string;
  platform: ExportPlatform;
  width: number;
  height: number;
  fps: number;
  video_codec: "h264" | "h265" | "av1" | "prores";
  audio_codec: "aac" | "opus" | "pcm";
  container: "mp4" | "mov" | "webm" | "wav" | "mp3";
}

export interface RenderJob {
  job_id: string;
  project_id: string;
  timeline_id?: string;
  preset: ExportPreset;
  output_uri: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export function createRenderJob(input: Omit<RenderJob, "status" | "created_at"> & { created_at?: string }): RenderJob {
  return {
    ...input,
    status: "queued",
    created_at: input.created_at ?? new Date().toISOString(),
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
];
