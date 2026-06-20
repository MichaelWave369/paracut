import {
  appendProbeExecutionReceiptToProject,
  buildFfprobeArgs,
  createProbeExecutionRequest,
  createProbeExecutionResult,
  parseFfprobeJson,
  probeExecutionToMediaProbeResult,
} from "../packages/probe-executor-core/src/index";
import { createProject, importMediaToProject } from "../packages/project-core/src/index";

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

let project = createProject({
  project_id: "project-probe-executor-smoke",
  name: "Probe Executor Smoke",
  created_at: "2026-06-19T00:00:00.000Z",
});

project = importMediaToProject(project, {
  asset_id: "asset_executor_video",
  kind: "video",
  name: "executor-video.mp4",
  uri: "file:///tmp/paracut/executor-video.mp4",
  imported_at: "2026-06-19T00:00:01.000Z",
});

const asset = project.media.assets.find((candidate) => candidate.asset_id === "asset_executor_video");
if (!asset) throw new Error("Expected imported executor asset");

const args = buildFfprobeArgs(asset.uri);
expectEqual(args[0], "-v", "FFprobe args should start with verbosity flag");
expectEqual(args[args.length - 1], asset.uri, "FFprobe args should end with source URI");
expectTrue(args.includes("-show_streams"), "FFprobe args should request streams");
expectTrue(args.includes("-show_format"), "FFprobe args should request format");

const request = createProbeExecutionRequest({
  asset,
  project_id: project.project_id,
  executable_path: "/usr/local/bin/ffprobe",
  request_id: "probe_exec_smoke_success",
  requested_at: "2026-06-19T00:00:02.000Z",
  timeout_ms: 12_000,
});

expectEqual(request.schema_version, "paracut.probe-executor.v0", "Executor request schema should match");
expectEqual(request.project_id, project.project_id, "Executor request should carry project id");
expectEqual(request.executable_path, "/usr/local/bin/ffprobe", "Executor request should preserve executable path");
expectEqual(request.timeout_ms, 12_000, "Executor request should preserve timeout");

const ffprobeStdout = JSON.stringify({
  format: {
    format_name: "mov,mp4,m4a,3gp,3g2,mj2",
    duration: "12.500000",
    bit_rate: "2400000",
    size: "3750000",
  },
  streams: [
    {
      index: 0,
      codec_type: "video",
      codec_name: "h264",
      width: 1920,
      height: 1080,
      avg_frame_rate: "30000/1001",
      duration: "12.500000",
      bit_rate: "2200000",
    },
    {
      index: 1,
      codec_type: "audio",
      codec_name: "aac",
      sample_rate: "48000",
      channels: 2,
      duration: "12.480000",
      bit_rate: "192000",
    },
  ],
});

const parsed = parseFfprobeJson(ffprobeStdout);
expectEqual(parsed.streams.length, 2, "Parsed ffprobe JSON should include two streams");
expectEqual(parsed.container?.duration_seconds, 12.5, "Parsed container duration should match");
expectEqual(parsed.video?.width, 1920, "Parsed video width should match");
expectEqual(parsed.video?.height, 1080, "Parsed video height should match");
expectTrue(Math.abs((parsed.video?.fps ?? 0) - 29.97002997002997) < 0.0001, "Parsed FPS should handle rational values");
expectEqual(parsed.audio?.sample_rate, 48_000, "Parsed audio sample rate should match");
expectEqual(parsed.audio?.channels, 2, "Parsed audio channel count should match");

const execution = createProbeExecutionResult({
  request,
  status: "completed",
  exit_code: 0,
  stdout: ffprobeStdout,
  stderr: "",
  started_at: "2026-06-19T00:00:02.000Z",
  ended_at: "2026-06-19T00:00:03.000Z",
  duration_ms: 1_000,
});

const success = probeExecutionToMediaProbeResult(request, execution);
expectEqual(success.probe.status, "probed", "Successful execution should produce probed media result");
expectEqual(success.probe.source, "ffprobe", "Successful execution should mark ffprobe source");
expectEqual(success.probe.metadata?.container?.duration_seconds, 12.5, "Successful probe should preserve duration");
expectEqual(success.probe.metadata?.video?.codec, "h264", "Successful probe should preserve video codec");
expectEqual(success.probe.metadata?.audio?.codec, "aac", "Successful probe should preserve audio codec");

const withSuccessReceipt = appendProbeExecutionReceiptToProject(project, request, execution, success.probe);
const successReceipt = withSuccessReceipt.ledger[withSuccessReceipt.ledger.length - 1];
if (!successReceipt) throw new Error("Expected success executor receipt");
expectEqual(successReceipt.type, "media.probe.executor.completed", "Successful execution should write completed executor receipt");
expectEqual(successReceipt.payload.probe_status, "probed", "Successful executor receipt should include probe status");

const failedExecution = createProbeExecutionResult({
  request,
  status: "completed",
  exit_code: 1,
  stdout: "",
  stderr: "Invalid data found when processing input",
  ended_at: "2026-06-19T00:00:04.000Z",
  duration_ms: 250,
});
const failed = probeExecutionToMediaProbeResult(request, failedExecution);
expectEqual(failed.probe.status, "failed", "Non-zero ffprobe exit should produce failed probe result");
expectTrue(failed.probe.errors.some((error) => error.includes("ffprobe exited with code 1")), "Failed probe should include exit code error");
const withFailureReceipt = appendProbeExecutionReceiptToProject(project, request, failedExecution, failed.probe);
const failureReceipt = withFailureReceipt.ledger[withFailureReceipt.ledger.length - 1];
if (!failureReceipt) throw new Error("Expected failure executor receipt");
expectEqual(failureReceipt.type, "media.probe.executor.failed", "Failed probe result should write failed executor receipt");
expectEqual(failureReceipt.payload.probe_status, "failed", "Failure executor receipt should include probe status");

const timeoutExecution = createProbeExecutionResult({
  request,
  status: "timed-out",
  stdout: "",
  stderr: "",
  error_message: "Timed out after 12000ms",
  ended_at: "2026-06-19T00:00:05.000Z",
  duration_ms: 12_000,
});
const timeout = probeExecutionToMediaProbeResult(request, timeoutExecution);
expectEqual(timeout.probe.status, "failed", "Timed-out execution should produce failed probe result");
const timeoutReceipt = appendProbeExecutionReceiptToProject(project, request, timeoutExecution, timeout.probe).ledger.at(-1);
if (!timeoutReceipt) throw new Error("Expected timeout executor receipt");
expectEqual(timeoutReceipt.type, "media.probe.executor.timed_out", "Timed-out execution should write timed_out receipt");

console.log("ParaCut probe executor smoke test passed.");
