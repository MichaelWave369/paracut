import { type LedgerReceipt } from "../../ledger-core/src/index";
import { type MediaProbeResult } from "../../media-probe-core/src/index";
import {
  createProbeExecutionReceipt,
  createProbeExecutionResult,
  probeExecutionToMediaProbeResult,
  type CreateProbeExecutionResultInput,
  type ProbeExecutionRequest,
  type ProbeExecutionResult,
  type ProbeExecutionStatus,
  type ProbeExecutor,
} from "../../probe-executor-core/src/index";

export const PROBE_RUNNER_SCHEMA_VERSION = "paracut.probe-runner.v0" as const;
export const DEFAULT_MOCK_PROBE_RUNNER_ID = "mock-probe-runner" as const;

export interface ProbeRunner extends ProbeExecutor {
  runner_id: string;
}

export interface ExecuteProbeWithRunnerInput {
  request: ProbeExecutionRequest;
  runner: ProbeExecutor | ProbeRunner;
  project_id?: string;
  runner_id?: string;
  include_receipt?: boolean;
  failed_at?: string;
}

export interface ProbeRunnerOutput {
  schema_version: typeof PROBE_RUNNER_SCHEMA_VERSION;
  runner_id: string;
  request: ProbeExecutionRequest;
  execution: ProbeExecutionResult;
  probe: MediaProbeResult;
  receipt?: LedgerReceipt;
}

export interface MockProbeRunnerFixture {
  request_id?: string;
  asset_id?: string;
  source_uri?: string;
  status: ProbeExecutionStatus;
  exit_code?: number;
  stdout?: string;
  stderr?: string;
  started_at?: string;
  ended_at?: string;
  duration_ms?: number;
  error_message?: string;
}

export interface CreateMockProbeRunnerInput {
  runner_id?: string;
  fixtures: MockProbeRunnerFixture[];
  unmatched_status?: ProbeExecutionStatus;
  unmatched_error_message?: string;
}

export async function executeProbeWithRunner(
  input: ExecuteProbeWithRunnerInput,
): Promise<ProbeRunnerOutput> {
  const runnerId = input.runner_id ?? getProbeRunnerId(input.runner);
  const includeReceipt = input.include_receipt ?? true;

  let execution: ProbeExecutionResult;
  try {
    execution = await input.runner.execute(input.request);
  } catch (error) {
    execution = createProbeExecutionResult({
      request: input.request,
      status: "failed",
      stdout: "",
      stderr: "",
      error_message: `Probe runner ${runnerId} threw: ${error instanceof Error ? error.message : String(error)}`,
      ended_at: input.failed_at ?? new Date().toISOString(),
    });
  }

  const normalizedExecution = normalizeRunnerExecutionResult(input.request, execution, runnerId, input.failed_at);
  const { probe } = probeExecutionToMediaProbeResult(input.request, normalizedExecution);

  const output: ProbeRunnerOutput = {
    schema_version: PROBE_RUNNER_SCHEMA_VERSION,
    runner_id: runnerId,
    request: input.request,
    execution: normalizedExecution,
    probe,
  };

  if (includeReceipt && input.project_id !== undefined) {
    output.receipt = createProbeExecutionReceipt(input.project_id, input.request, normalizedExecution, probe);
  }

  return output;
}

export function createMockProbeRunner(input: CreateMockProbeRunnerInput): ProbeRunner {
  const runnerId = input.runner_id ?? DEFAULT_MOCK_PROBE_RUNNER_ID;
  return {
    runner_id: runnerId,
    async execute(request: ProbeExecutionRequest): Promise<ProbeExecutionResult> {
      const fixture = findMockFixture(input.fixtures, request);
      if (fixture === undefined) {
        return createProbeExecutionResult({
          request,
          status: input.unmatched_status ?? "skipped",
          stdout: "",
          stderr: "",
          error_message: input.unmatched_error_message ?? `No mock probe fixture matched request ${request.request_id}.`,
          ended_at: new Date().toISOString(),
        });
      }

      return createResultFromFixture(request, fixture);
    },
  };
}

export function getProbeRunnerId(runner: ProbeExecutor | ProbeRunner): string {
  if ("runner_id" in runner && typeof runner.runner_id === "string" && runner.runner_id.length > 0) {
    return runner.runner_id;
  }
  return "anonymous-probe-runner";
}

export function normalizeRunnerExecutionResult(
  request: ProbeExecutionRequest,
  execution: ProbeExecutionResult,
  runnerId: string,
  failedAt?: string,
): ProbeExecutionResult {
  if (execution.request_id === request.request_id) return execution;

  return createProbeExecutionResult({
    request,
    status: "failed",
    stdout: execution.stdout,
    stderr: execution.stderr,
    error_message: `Probe runner ${runnerId} returned result for request ${execution.request_id}, expected ${request.request_id}.`,
    ended_at: failedAt ?? execution.ended_at ?? new Date().toISOString(),
  });
}

function findMockFixture(
  fixtures: MockProbeRunnerFixture[],
  request: ProbeExecutionRequest,
): MockProbeRunnerFixture | undefined {
  for (const fixture of fixtures) {
    if (fixture.request_id !== undefined && fixture.request_id === request.request_id) return fixture;
  }

  for (const fixture of fixtures) {
    if (
      fixture.asset_id !== undefined &&
      fixture.source_uri !== undefined &&
      fixture.asset_id === request.asset_id &&
      fixture.source_uri === request.source_uri
    ) {
      return fixture;
    }
  }

  for (const fixture of fixtures) {
    if (fixture.asset_id !== undefined && fixture.asset_id === request.asset_id) return fixture;
  }

  for (const fixture of fixtures) {
    if (fixture.source_uri !== undefined && fixture.source_uri === request.source_uri) return fixture;
  }

  for (const fixture of fixtures) {
    if (fixture.request_id === undefined && fixture.asset_id === undefined && fixture.source_uri === undefined) return fixture;
  }

  return undefined;
}

function createResultFromFixture(
  request: ProbeExecutionRequest,
  fixture: MockProbeRunnerFixture,
): ProbeExecutionResult {
  const resultInput: CreateProbeExecutionResultInput = {
    request,
    status: fixture.status,
    stdout: fixture.stdout ?? "",
    stderr: fixture.stderr ?? "",
  };

  if (fixture.exit_code !== undefined) resultInput.exit_code = fixture.exit_code;
  if (fixture.started_at !== undefined) resultInput.started_at = fixture.started_at;
  if (fixture.ended_at !== undefined) resultInput.ended_at = fixture.ended_at;
  if (fixture.duration_ms !== undefined) resultInput.duration_ms = fixture.duration_ms;
  if (fixture.error_message !== undefined) resultInput.error_message = fixture.error_message;

  return createProbeExecutionResult(resultInput);
}
