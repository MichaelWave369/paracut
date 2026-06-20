import {
  createMockProbeRunner,
  executeProbeWithRunner,
  type ProbeRunner,
} from "../packages/probe-runner-core/src/index";
import { createProbeExecutionRequest } from "../packages/probe-executor-core/src/index";
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
  project_id: "project-probe-runner-smoke",
  name: "Probe Runner Smoke",
  created_at: "2026-06-19T00:00:00.000Z",
});

project = importMediaToProject(project, {
  asset_id: "asset_runner_video",
  kind: "video",
  name: "runner-video.mp4",
  uri: "file:///tmp/paracut/runner-video.mp4",
  imported_at: "2026-06-19T00:00:01.000Z",
});

const asset = project.media.assets.find((candidate) => candidate.asset_id === "asset_runner_video");
if (!asset) throw new Error("Expected imported runner asset");

const successRequest = createProbeExecutionRequest({
  asset,
  project_id: project.project_id,
  request_id: "runner_success_request",
  requested_at: "2026-06-19T00:00:02.000Z",
  timeout_ms: 10_000,
});

const ffprobeStdout = JSON.stringify({
  format: {
    format_name: "mov,mp4,m4a,3gp,3g2,mj2",
    duration: "42.000000",
    bit_rate: "3200000",
    size: "16800000",
  },
  streams: [
    {
      index: 0,
      codec_type: "video",
      codec_name: "h264",
      width: 3840,
      height: 2160,
      avg_frame_rate: "60/1",
      duration: "42.000000",
      bit_rate: "3000000",
    },
    {
      index: 1,
      codec_type: "audio",
      codec_name: "aac",
      sample_rate: "48000",
      channels: 2,
      duration: "41.900000",
      bit_rate: "192000",
    },
  ],
});

const successRunner = createMockProbeRunner({
  runner_id: "mock-success-runner",
  fixtures: [
    {
      request_id: successRequest.request_id,
      status: "completed",
      exit_code: 0,
      stdout: ffprobeStdout,
      stderr: "",
      started_at: "2026-06-19T00:00:02.000Z",
      ended_at: "2026-06-19T00:00:03.000Z",
      duration_ms: 1_000,
    },
  ],
});

const successRun = await executeProbeWithRunner({
  project_id: project.project_id,
  request: successRequest,
  runner: successRunner,
});

expectEqual(successRun.schema_version, "paracut.probe-runner.v0", "Probe runner schema should match");
expectEqual(successRun.runner_id, "mock-success-runner", "Runner id should be preserved");
expectEqual(successRun.execution.status, "completed", "Success fixture should complete");
expectEqual(successRun.probe.status, "probed", "Success runner should produce probed result");
expectEqual(successRun.probe.metadata?.video?.width, 3840, "Success runner should parse video width");
expectEqual(successRun.probe.metadata?.audio?.codec, "aac", "Success runner should parse audio codec");
if (!successRun.receipt) throw new Error("Expected success runner receipt");
expectEqual(successRun.receipt.type, "media.probe.executor.completed", "Success runner should create completed receipt");
expectEqual(successRun.receipt.payload.probe_status, "probed", "Success receipt should include probed status");

const failureRequest = createProbeExecutionRequest({
  asset,
  project_id: project.project_id,
  request_id: "runner_failure_request",
  requested_at: "2026-06-19T00:00:04.000Z",
});

const failureRunner = createMockProbeRunner({
  runner_id: "mock-failure-runner",
  fixtures: [
    {
      request_id: failureRequest.request_id,
      status: "completed",
      exit_code: 1,
      stdout: "",
      stderr: "Invalid data found when processing input",
      ended_at: "2026-06-19T00:00:05.000Z",
      duration_ms: 200,
    },
  ],
});

const failureRun = await executeProbeWithRunner({
  project_id: project.project_id,
  request: failureRequest,
  runner: failureRunner,
});
expectEqual(failureRun.probe.status, "failed", "Non-zero mock exit should become failed probe");
expectTrue(failureRun.probe.errors.some((error) => error.includes("ffprobe exited with code 1")), "Failure should include exit-code error");
if (!failureRun.receipt) throw new Error("Expected failure runner receipt");
expectEqual(failureRun.receipt.type, "media.probe.executor.failed", "Failure runner should create failed receipt");

const timeoutRequest = createProbeExecutionRequest({
  asset,
  project_id: project.project_id,
  request_id: "runner_timeout_request",
  requested_at: "2026-06-19T00:00:06.000Z",
  timeout_ms: 500,
});

const timeoutRunner = createMockProbeRunner({
  runner_id: "mock-timeout-runner",
  fixtures: [
    {
      request_id: timeoutRequest.request_id,
      status: "timed-out",
      stdout: "",
      stderr: "",
      error_message: "Timed out after 500ms",
      ended_at: "2026-06-19T00:00:07.000Z",
      duration_ms: 500,
    },
  ],
});

const timeoutRun = await executeProbeWithRunner({
  project_id: project.project_id,
  request: timeoutRequest,
  runner: timeoutRunner,
});
expectEqual(timeoutRun.execution.status, "timed-out", "Timeout fixture should preserve timed-out status");
expectEqual(timeoutRun.probe.status, "failed", "Timed-out runner should produce failed probe result");
if (!timeoutRun.receipt) throw new Error("Expected timeout runner receipt");
expectEqual(timeoutRun.receipt.type, "media.probe.executor.timed_out", "Timeout runner should create timed_out receipt");

const skippedRequest = createProbeExecutionRequest({
  asset,
  project_id: project.project_id,
  request_id: "runner_skipped_request",
  requested_at: "2026-06-19T00:00:08.000Z",
});
const skippedRunner = createMockProbeRunner({ runner_id: "mock-skipped-runner", fixtures: [] });
const skippedRun = await executeProbeWithRunner({
  project_id: project.project_id,
  request: skippedRequest,
  runner: skippedRunner,
});
expectEqual(skippedRun.execution.status, "skipped", "Unmatched mock request should skip");
expectEqual(skippedRun.probe.status, "skipped", "Skipped execution should create skipped probe");
if (!skippedRun.receipt) throw new Error("Expected skipped runner receipt");
expectEqual(skippedRun.receipt.type, "media.probe.executor.skipped", "Skipped runner should create skipped receipt");

const thrownRequest = createProbeExecutionRequest({
  asset,
  project_id: project.project_id,
  request_id: "runner_thrown_request",
  requested_at: "2026-06-19T00:00:09.000Z",
});
const throwingRunner: ProbeRunner = {
  runner_id: "throwing-runner",
  async execute() {
    throw new Error("boom");
  },
};
const thrownRun = await executeProbeWithRunner({
  project_id: project.project_id,
  request: thrownRequest,
  runner: throwingRunner,
  failed_at: "2026-06-19T00:00:10.000Z",
});
expectEqual(thrownRun.execution.status, "failed", "Thrown runner should normalize to failed execution");
expectEqual(thrownRun.probe.status, "failed", "Thrown runner should normalize to failed probe");
expectTrue(thrownRun.probe.errors.some((error) => error.includes("throwing-runner") && error.includes("boom")), "Thrown runner should include runner id and error");
if (!thrownRun.receipt) throw new Error("Expected thrown runner receipt");
expectEqual(thrownRun.receipt.type, "media.probe.executor.failed", "Thrown runner should create failed receipt");

console.log("ParaCut probe runner smoke test passed.");
