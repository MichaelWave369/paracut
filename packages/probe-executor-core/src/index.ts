import { appendReceipt, createReceipt, type LedgerReceipt } from "../../ledger-core/src/index";
import { type MediaAsset } from "../../media-core/src/index";
import {
  createMediaProbeResult,
  type AudioProbeMetadata,
  type ContainerProbeMetadata,
  type CreateMediaProbeResultInput,
  type MediaProbeMetadata,
  type MediaProbeResult,
  type MediaProbeStream,
  type VideoProbeMetadata,
} from "../../media-probe-core/src/index";
import { type ParaCutProject } from "../../project-core/src/index";

export const PROBE_EXECUTOR_SCHEMA_VERSION = "paracut.probe-executor.v0" as const;
export const DEFAULT_FFPROBE_EXECUTABLE = "ffprobe" as const;
export const DEFAULT_PROBE_TIMEOUT_MS = 30_000;

export type ProbeExecutionStatus = "completed" | "failed" | "timed-out" | "skipped";

export interface ProbeExecutionRequest {
  schema_version: typeof PROBE_EXECUTOR_SCHEMA_VERSION;
  request_id: string;
  project_id?: string;
  asset_id: string;
  source_uri: string;
  executable_path: string;
  args: string[];
  timeout_ms: number;
  requested_at: string;
}

export interface CreateProbeExecutionRequestInput {
  asset: MediaAsset;
  project_id?: string;
  executable_path?: string;
  timeout_ms?: number;
  requested_at?: string;
  request_id?: string;
}

export interface ProbeExecutionResult {
  request_id: string;
  status: ProbeExecutionStatus;
  exit_code?: number;
  stdout: string;
  stderr: string;
  started_at?: string;
  ended_at?: string;
  duration_ms?: number;
  error_message?: string;
}

export interface CreateProbeExecutionResultInput {
  request: ProbeExecutionRequest;
  status: ProbeExecutionStatus;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  started_at?: string;
  ended_at?: string;
  duration_ms?: number;
  error_message?: string;
}

export interface ProbeExecutor {
  execute(request: ProbeExecutionRequest): Promise<ProbeExecutionResult>;
}

export interface ProbeExecutionToResultOutput {
  execution: ProbeExecutionResult;
  probe: MediaProbeResult;
}

interface FfprobeJsonFormat {
  format_name?: string;
  duration?: string | number;
  bit_rate?: string | number;
  size?: string | number;
}

interface FfprobeJsonStream {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  duration?: string | number;
  bit_rate?: string | number;
  sample_rate?: string | number;
  channels?: number;
}

interface FfprobeJsonPayload {
  format?: FfprobeJsonFormat;
  streams?: FfprobeJsonStream[];
}

export function createProbeExecutionRequest(
  input: CreateProbeExecutionRequestInput,
): ProbeExecutionRequest {
  const timeoutMs = input.timeout_ms ?? DEFAULT_PROBE_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error("Probe timeout_ms must be a positive finite number");

  const request: ProbeExecutionRequest = {
    schema_version: PROBE_EXECUTOR_SCHEMA_VERSION,
    request_id: input.request_id ?? createExecutionRequestId(),
    asset_id: input.asset.asset_id,
    source_uri: input.asset.uri,
    executable_path: input.executable_path ?? DEFAULT_FFPROBE_EXECUTABLE,
    args: buildFfprobeArgs(input.asset.uri),
    timeout_ms: timeoutMs,
    requested_at: input.requested_at ?? new Date().toISOString(),
  };

  if (input.project_id !== undefined) request.project_id = input.project_id;

  return request;
}

export function buildFfprobeArgs(sourceUri: string): string[] {
  if (!sourceUri) throw new Error("FFprobe args require a source URI");

  return [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    sourceUri,
  ];
}

export function createProbeExecutionResult(
  input: CreateProbeExecutionResultInput,
): ProbeExecutionResult {
  const result: ProbeExecutionResult = {
    request_id: input.request.request_id,
    status: input.status,
    stdout: input.stdout ?? "",
    stderr: input.stderr ?? "",
  };

  if (input.exit_code !== undefined) result.exit_code = input.exit_code;
  if (input.started_at !== undefined) result.started_at = input.started_at;
  if (input.ended_at !== undefined) result.ended_at = input.ended_at;
  if (input.duration_ms !== undefined) result.duration_ms = input.duration_ms;
  if (input.error_message !== undefined) result.error_message = input.error_message;

  return result;
}

export function probeExecutionToMediaProbeResult(
  request: ProbeExecutionRequest,
  execution: ProbeExecutionResult,
): ProbeExecutionToResultOutput {
  if (execution.request_id !== request.request_id) {
    throw new Error(`Probe execution result ${execution.request_id} does not match request ${request.request_id}`);
  }

  const base: Omit<CreateMediaProbeResultInput, "status"> = {
    asset_id: request.asset_id,
    source_uri: request.source_uri,
    probe_id: `probe_${request.request_id}`,
    source: "ffprobe",
    probed_at: execution.ended_at ?? new Date().toISOString(),
  };
  if (request.project_id !== undefined) base.project_id = request.project_id;

  if (execution.status === "skipped") {
    return {
      execution,
      probe: createMediaProbeResult({
        ...base,
        status: "skipped",
        warnings: [execution.error_message ?? "Probe execution was skipped."],
      }),
    };
  }

  if (execution.status === "timed-out") {
    return {
      execution,
      probe: createMediaProbeResult({
        ...base,
        status: "failed",
        errors: [execution.error_message ?? `Probe execution timed out after ${request.timeout_ms}ms.`],
      }),
    };
  }

  if (execution.status === "failed" || (execution.exit_code !== undefined && execution.exit_code !== 0)) {
    return {
      execution,
      probe: createMediaProbeResult({
        ...base,
        status: "failed",
        errors: buildFailureErrors(execution),
      }),
    };
  }

  try {
    const metadata = parseFfprobeJson(execution.stdout);
    return {
      execution,
      probe: createMediaProbeResult({
        ...base,
        status: "probed",
        metadata,
        warnings: buildParseWarnings(metadata),
      }),
    };
  } catch (error) {
    return {
      execution,
      probe: createMediaProbeResult({
        ...base,
        status: "failed",
        errors: [`Failed to parse ffprobe JSON: ${error instanceof Error ? error.message : String(error)}`],
      }),
    };
  }
}

export function parseFfprobeJson(stdout: string): MediaProbeMetadata {
  if (!stdout.trim()) throw new Error("ffprobe stdout was empty");

  const parsed = JSON.parse(stdout) as FfprobeJsonPayload;
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const probeStreams = streams.map(toMediaProbeStream);
  const video = firstDefined(probeStreams.filter((stream) => stream.stream_type === "video").map(toVideoMetadata));
  const audio = firstDefined(probeStreams.filter((stream) => stream.stream_type === "audio").map(toAudioMetadata));
  const container = toContainerMetadata(parsed.format);

  const metadata: MediaProbeMetadata = { streams: probeStreams };
  if (container !== undefined) metadata.container = container;
  if (video !== undefined) metadata.video = video;
  if (audio !== undefined) metadata.audio = audio;

  return metadata;
}

export function createProbeExecutionReceipt(
  projectId: string,
  request: ProbeExecutionRequest,
  execution: ProbeExecutionResult,
  probe?: MediaProbeResult,
): LedgerReceipt {
  const createdAt = execution.ended_at ?? new Date().toISOString();
  return createReceipt({
    type: toProbeExecutionReceiptType(execution, probe),
    project_id: projectId,
    source: "system",
    approved_by: "system",
    created_at: createdAt,
    payload: {
      request_id: request.request_id,
      asset_id: request.asset_id,
      source_uri: request.source_uri,
      executable_path: request.executable_path,
      args: request.args,
      timeout_ms: request.timeout_ms,
      execution_status: execution.status,
      exit_code: execution.exit_code ?? null,
      duration_ms: execution.duration_ms ?? null,
      stdout_bytes: execution.stdout.length,
      stderr_bytes: execution.stderr.length,
      error_message: execution.error_message ?? null,
      probe_id: probe?.probe_id ?? null,
      probe_status: probe?.status ?? null,
      warning_count: probe?.warnings.length ?? 0,
      error_count: probe?.errors.length ?? 0,
    },
  });
}

export function appendProbeExecutionReceiptToProject(
  project: ParaCutProject,
  request: ProbeExecutionRequest,
  execution: ProbeExecutionResult,
  probe?: MediaProbeResult,
): ParaCutProject {
  const receipt = createProbeExecutionReceipt(project.project_id, request, execution, probe);
  return {
    ...project,
    updated_at: receipt.created_at,
    ledger: appendReceipt(project.ledger, receipt),
  };
}

function toProbeExecutionReceiptType(
  execution: ProbeExecutionResult,
  probe: MediaProbeResult | undefined,
): string {
  if (execution.status === "timed-out") return "media.probe.executor.timed_out";
  if (execution.status === "skipped") return "media.probe.executor.skipped";
  if (probe?.status === "probed") return "media.probe.executor.completed";
  return "media.probe.executor.failed";
}

function toContainerMetadata(format: FfprobeJsonFormat | undefined): ContainerProbeMetadata | undefined {
  if (format === undefined) return undefined;

  const metadata: ContainerProbeMetadata = {};
  if (format.format_name !== undefined) metadata.format_name = format.format_name;

  const duration = toNumber(format.duration);
  const bitrate = toNumber(format.bit_rate);
  const size = toNumber(format.size);
  if (duration !== undefined) metadata.duration_seconds = duration;
  if (bitrate !== undefined) metadata.bitrate = bitrate;
  if (size !== undefined) metadata.size_bytes = size;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function toMediaProbeStream(stream: FfprobeJsonStream, fallbackIndex: number): MediaProbeStream {
  const streamType = toStreamType(stream.codec_type);
  const probeStream: MediaProbeStream = {
    stream_index: stream.index ?? fallbackIndex,
    stream_type: streamType,
  };

  if (stream.codec_name !== undefined) probeStream.codec = stream.codec_name;
  if (stream.duration !== undefined) {
    const duration = toNumber(stream.duration);
    if (duration !== undefined) probeStream.duration_seconds = duration;
  }
  if (stream.width !== undefined) probeStream.width = stream.width;
  if (stream.height !== undefined) probeStream.height = stream.height;

  const fps = parseFps(stream.avg_frame_rate) ?? parseFps(stream.r_frame_rate);
  if (fps !== undefined) probeStream.fps = fps;

  const sampleRate = toNumber(stream.sample_rate);
  if (sampleRate !== undefined) probeStream.sample_rate = sampleRate;
  if (stream.channels !== undefined) probeStream.channels = stream.channels;

  const bitrate = toNumber(stream.bit_rate);
  if (bitrate !== undefined) probeStream.bitrate = bitrate;

  return probeStream;
}

function toVideoMetadata(stream: MediaProbeStream): VideoProbeMetadata | undefined {
  if (stream.stream_type !== "video") return undefined;

  const video: VideoProbeMetadata = {};
  if (stream.codec !== undefined) video.codec = stream.codec;
  if (stream.width !== undefined) video.width = stream.width;
  if (stream.height !== undefined) video.height = stream.height;
  if (stream.fps !== undefined) video.fps = stream.fps;
  if (stream.bitrate !== undefined) video.bitrate = stream.bitrate;

  return Object.keys(video).length > 0 ? video : undefined;
}

function toAudioMetadata(stream: MediaProbeStream): AudioProbeMetadata | undefined {
  if (stream.stream_type !== "audio") return undefined;

  const audio: AudioProbeMetadata = {};
  if (stream.codec !== undefined) audio.codec = stream.codec;
  if (stream.sample_rate !== undefined) audio.sample_rate = stream.sample_rate;
  if (stream.channels !== undefined) audio.channels = stream.channels;
  if (stream.bitrate !== undefined) audio.bitrate = stream.bitrate;

  return Object.keys(audio).length > 0 ? audio : undefined;
}

function buildFailureErrors(execution: ProbeExecutionResult): string[] {
  const errors: string[] = [];
  if (execution.error_message) errors.push(execution.error_message);
  if (execution.stderr.trim()) errors.push(execution.stderr.trim());
  if (execution.exit_code !== undefined && execution.exit_code !== 0) {
    errors.push(`ffprobe exited with code ${execution.exit_code}.`);
  }
  if (errors.length === 0) errors.push("Probe execution failed without stderr or error_message.");
  return errors;
}

function buildParseWarnings(metadata: MediaProbeMetadata): string[] {
  const warnings: string[] = [];
  if (!metadata.video && !metadata.audio) warnings.push("ffprobe JSON did not include video or audio stream metadata.");
  if (metadata.streams.length === 0) warnings.push("ffprobe JSON did not include streams.");
  return warnings;
}

function toStreamType(value: string | undefined): MediaProbeStream["stream_type"] {
  if (value === "video" || value === "audio" || value === "subtitle" || value === "data") return value;
  return "unknown";
}

function toNumber(value: string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : undefined;
}

function parseFps(value: string | undefined): number | undefined {
  if (value === undefined || value === "0/0") return undefined;

  if (value.includes("/")) {
    const [numeratorText, denominatorText] = value.split("/", 2);
    const numerator = Number(numeratorText);
    const denominator = Number(denominatorText);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return undefined;
    const fps = numerator / denominator;
    return Number.isFinite(fps) && fps > 0 ? fps : undefined;
  }

  const fps = Number(value);
  return Number.isFinite(fps) && fps > 0 ? fps : undefined;
}

function firstDefined<T>(values: Array<T | undefined>): T | undefined {
  return values.find((value): value is T => value !== undefined);
}

function createExecutionRequestId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `probe_exec_${Date.now().toString(36)}_${random}`;
}
