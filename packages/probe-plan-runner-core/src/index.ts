import { appendReceipt, createReceipt, type LedgerReceipt } from "../../ledger-core/src/index";
import { applyMediaProbeResultToProject, type MediaProbeResult } from "../../media-probe-core/src/index";
import { saveProbeResultToCache, type ProbeCacheWriteResult } from "../../probe-cache-core/src/index";
import {
  createProbeExecutionRequest,
  type CreateProbeExecutionRequestInput,
  type ProbeExecutionRequest,
  type ProbeExecutionResult,
  type ProbeExecutor,
} from "../../probe-executor-core/src/index";
import type { ProbePlan, ProbePlanItem } from "../../probe-planning-core/src/index";
import {
  createProbeProgressBatch,
  createProbeProgressEvent,
  type ProbeProgressBatch,
  type ProbeProgressEvent,
  type ProbeProgressEventType,
} from "../../probe-progress-core/src/index";
import {
  executeProbeWithRunner,
  getProbeRunnerId,
  type ExecuteProbeWithRunnerInput,
  type ProbeRunner,
} from "../../probe-runner-core/src/index";
import { getProjectMedia, type ParaCutProject } from "../../project-core/src/index";

export const PROBE_PLAN_RUNNER_SCHEMA_VERSION = "paracut.probe-plan-runner.v0" as const;

export type ProbePlanRunnerItemStatus = "applied" | "failed" | "skipped";
export type ProbePlanRunnerSkipReason =
  | "not-needs-probe"
  | "missing-asset"
  | "missing-cache-key-input"
  | "probe-not-successful"
  | "cache-write-failed";

export type ProbePlanRunnerProgressHandler = (event: ProbeProgressEvent) => void | Promise<void>;

export interface RunProbePlanWithRunnerInput {
  project: ParaCutProject;
  plan: ProbePlan;
  runner: ProbeExecutor | ProbeRunner;
  executable_path?: string | undefined;
  timeout_ms?: number | undefined;
  requested_at?: string | undefined;
  include_executor_receipts?: boolean | undefined;
  include_summary_receipt?: boolean | undefined;
  cache_successful_results?: boolean | undefined;
  summary_created_at?: string | undefined;
  include_progress_batch?: boolean | undefined;
  progress_batch_id?: string | undefined;
  progress_created_at?: string | undefined;
  include_queued_progress_events?: boolean | undefined;
  include_running_progress_events?: boolean | undefined;
  include_cached_progress_events?: boolean | undefined;
  on_progress_event?: ProbePlanRunnerProgressHandler | undefined;
}

export interface ProbePlanRunnerItemResult {
  schema_version: typeof PROBE_PLAN_RUNNER_SCHEMA_VERSION;
  asset_id: string;
  source_uri: string;
  plan_status: ProbePlanItem["status"];
  status: ProbePlanRunnerItemStatus;
  reason: string;
  skip_reason?: ProbePlanRunnerSkipReason;
  request?: ProbeExecutionRequest;
  execution?: ProbeExecutionResult;
  probe?: MediaProbeResult;
  executor_receipt?: LedgerReceipt;
  cache_write?: ProbeCacheWriteResult;
}

export interface ProbePlanRunnerCounts {
  item_count: number;
  executed_count: number;
  applied_count: number;
  failed_count: number;
  skipped_count: number;
  cached_count: number;
}

export interface ProbePlanRunnerResult {
  schema_version: typeof PROBE_PLAN_RUNNER_SCHEMA_VERSION;
  runner_id: string;
  plan_id: string;
  project_id: string;
  project_root_dir: string;
  created_at: string;
  project: ParaCutProject;
  items: ProbePlanRunnerItemResult[];
  counts: ProbePlanRunnerCounts;
  summary_receipt?: LedgerReceipt;
  progress_batch?: ProbeProgressBatch;
}

interface CreateItemResultInput {
  status: ProbePlanRunnerItemStatus;
  reason: string;
  skip_reason?: ProbePlanRunnerSkipReason;
  request?: ProbeExecutionRequest;
  execution?: ProbeExecutionResult;
  probe?: MediaProbeResult;
  executor_receipt?: LedgerReceipt;
  cache_write?: ProbeCacheWriteResult;
}

export async function runProbePlanWithRunner(
  input: RunProbePlanWithRunnerInput,
): Promise<ProbePlanRunnerResult> {
  if (input.plan.project_id !== input.project.project_id) {
    throw new Error(`Probe plan project_id ${input.plan.project_id} does not match project ${input.project.project_id}`);
  }

  const runnerId = getProbeRunnerId(input.runner);
  const includeExecutorReceipts = input.include_executor_receipts ?? true;
  const includeSummaryReceipt = input.include_summary_receipt ?? true;
  const cacheSuccessfulResults = input.cache_successful_results ?? true;
  const createdAt = input.summary_created_at ?? input.requested_at ?? new Date().toISOString();
  const progress = createProgressController(input, createdAt);

  let project = input.project;
  const items: ProbePlanRunnerItemResult[] = [];

  for (const item of input.plan.items) {
    if (progress !== undefined && progress.include_queued_events) {
      await emitPlanItemProgress(progress, input.plan, runnerId, item, {
        event_type: "queued",
        message: `Probe work queued for ${item.asset_id}.`,
        created_at: progress.created_at,
      });
    }

    const itemInput: RunProbePlanItemInput = {
      project,
      plan: input.plan,
      item,
      runner: input.runner,
      runner_id: runnerId,
      include_executor_receipt: includeExecutorReceipts,
      cache_successful_result: cacheSuccessfulResults,
    };
    if (input.executable_path !== undefined) itemInput.executable_path = input.executable_path;
    if (input.timeout_ms !== undefined) itemInput.timeout_ms = input.timeout_ms;
    if (input.requested_at !== undefined) itemInput.requested_at = input.requested_at;
    if (progress !== undefined) itemInput.progress = progress;

    const result = await runProbePlanItem(itemInput);

    project = result.project;
    items.push(result.item_result);

    if (progress !== undefined) {
      await emitTerminalProgressForRunnerItem(progress, input.plan, runnerId, result.item_result);
    }
  }

  const counts = summarizeProbePlanRunnerItems(items);
  let summaryReceipt: LedgerReceipt | undefined;

  if (includeSummaryReceipt) {
    summaryReceipt = createProbePlanRunnerReceipt(input.plan, runnerId, items, counts, createdAt);
    project = {
      ...project,
      updated_at: summaryReceipt.created_at,
      ledger: appendReceipt(project.ledger, summaryReceipt),
    };
  }

  const result: ProbePlanRunnerResult = {
    schema_version: PROBE_PLAN_RUNNER_SCHEMA_VERSION,
    runner_id: runnerId,
    plan_id: input.plan.plan_id,
    project_id: input.project.project_id,
    project_root_dir: input.plan.project_root_dir,
    created_at: createdAt,
    project,
    items,
    counts,
  };

  if (summaryReceipt !== undefined) result.summary_receipt = summaryReceipt;
  if (progress !== undefined && progress.collect_batch) {
    result.progress_batch = createProbeProgressBatch({
      batch_id: progress.batch_id,
      project_id: input.project.project_id,
      plan_id: input.plan.plan_id,
      runner_id: runnerId,
      created_at: inferFirstProgressEventTime(progress.events) ?? progress.created_at,
      updated_at: inferLastProgressEventTime(progress.events) ?? progress.created_at,
      events: progress.events,
    });
  }
  return result;
}

export function summarizeProbePlanRunnerItems(items: ProbePlanRunnerItemResult[]): ProbePlanRunnerCounts {
  return {
    item_count: items.length,
    executed_count: items.filter((item) => item.request !== undefined).length,
    applied_count: items.filter((item) => item.status === "applied").length,
    failed_count: items.filter((item) => item.status === "failed").length,
    skipped_count: items.filter((item) => item.status === "skipped").length,
    cached_count: items.filter((item) => item.cache_write !== undefined).length,
  };
}

interface RunProbePlanItemInput {
  project: ParaCutProject;
  plan: ProbePlan;
  item: ProbePlanItem;
  runner: ProbeExecutor | ProbeRunner;
  runner_id: string;
  executable_path?: string | undefined;
  timeout_ms?: number | undefined;
  requested_at?: string | undefined;
  include_executor_receipt: boolean;
  cache_successful_result: boolean;
  progress?: ProbePlanRunnerProgressController | undefined;
}

interface RunProbePlanItemOutput {
  project: ParaCutProject;
  item_result: ProbePlanRunnerItemResult;
}

async function runProbePlanItem(input: RunProbePlanItemInput): Promise<RunProbePlanItemOutput> {
  if (input.item.status !== "needs-probe") {
    return skippedItem(input.item, "not-needs-probe", `Plan item is ${input.item.status}; runner only executes needs-probe items.`, input.project);
  }

  const asset = getProjectMedia(input.project, input.item.asset_id);
  if (asset === undefined) {
    return skippedItem(input.item, "missing-asset", "Media asset was not found in the project.", input.project);
  }

  if (input.item.cache_key_input === undefined) {
    return skippedItem(input.item, "missing-cache-key-input", "Needs-probe item did not include cache key input.", input.project);
  }

  const requestInput: CreateProbeExecutionRequestInput = {
    asset,
    project_id: input.project.project_id,
    request_id: createPlanRunnerRequestId(input.plan.plan_id, asset.asset_id),
  };
  if (input.executable_path !== undefined) requestInput.executable_path = input.executable_path;
  if (input.timeout_ms !== undefined) requestInput.timeout_ms = input.timeout_ms;
  if (input.requested_at !== undefined) requestInput.requested_at = input.requested_at;
  const request = createProbeExecutionRequest(requestInput);

  if (input.progress !== undefined && input.progress.include_running_events) {
    await emitPlanItemProgress(input.progress, input.plan, input.runner_id, input.item, {
      event_type: "running",
      message: `Probe runner started for ${input.item.asset_id}.`,
      created_at: request.requested_at,
      request_id: request.request_id,
    });
  }

  const runnerInput: ExecuteProbeWithRunnerInput = {
    request,
    runner: input.runner,
    runner_id: input.runner_id,
    project_id: input.project.project_id,
    include_receipt: input.include_executor_receipt,
  };
  if (input.requested_at !== undefined) runnerInput.failed_at = input.requested_at;
  const runnerOutput = await executeProbeWithRunner(runnerInput);

  let project = input.project;
  if (runnerOutput.receipt !== undefined) {
    project = {
      ...project,
      updated_at: runnerOutput.receipt.created_at,
      ledger: appendReceipt(project.ledger, runnerOutput.receipt),
    };
  }

  if (runnerOutput.probe.status !== "probed" || runnerOutput.probe.metadata === undefined) {
    const failedInput: CreateItemResultInput = {
      status: "failed",
      reason: runnerOutput.probe.errors[0] ?? runnerOutput.probe.warnings[0] ?? "Probe runner did not produce successful metadata.",
      skip_reason: "probe-not-successful",
      request,
      execution: runnerOutput.execution,
      probe: runnerOutput.probe,
    };
    if (runnerOutput.receipt !== undefined) failedInput.executor_receipt = runnerOutput.receipt;
    return {
      project,
      item_result: createItemResult(input.item, failedInput),
    };
  }

  const applied = applyMediaProbeResultToProject(project, runnerOutput.probe);
  project = applied.project;

  let cacheWrite: ProbeCacheWriteResult | undefined;
  if (input.cache_successful_result) {
    try {
      const cacheInput = {
        result: runnerOutput.probe,
      };
      if (input.item.cache_key_input.source_fingerprint !== undefined) {
        Object.assign(cacheInput, { source_fingerprint: input.item.cache_key_input.source_fingerprint });
      }
      cacheWrite = await saveProbeResultToCache(input.plan.project_root_dir, cacheInput);
    } catch (error) {
      const cacheFailureInput: CreateItemResultInput = {
        status: "failed",
        reason: `Probe metadata was applied but cache write failed: ${error instanceof Error ? error.message : String(error)}`,
        skip_reason: "cache-write-failed",
        request,
        execution: runnerOutput.execution,
        probe: runnerOutput.probe,
      };
      if (runnerOutput.receipt !== undefined) cacheFailureInput.executor_receipt = runnerOutput.receipt;
      return {
        project,
        item_result: createItemResult(input.item, cacheFailureInput),
      };
    }
  }

  const appliedInput: CreateItemResultInput = {
    status: "applied",
    reason: cacheWrite === undefined
      ? "Probe runner produced metadata and it was applied to the project."
      : "Probe runner produced metadata, it was applied to the project, and it was cached.",
    request,
    execution: runnerOutput.execution,
    probe: runnerOutput.probe,
  };
  if (runnerOutput.receipt !== undefined) appliedInput.executor_receipt = runnerOutput.receipt;
  if (cacheWrite !== undefined) appliedInput.cache_write = cacheWrite;

  return {
    project,
    item_result: createItemResult(input.item, appliedInput),
  };
}

function skippedItem(
  item: ProbePlanItem,
  skipReason: ProbePlanRunnerSkipReason,
  reason: string,
  project: ParaCutProject,
): RunProbePlanItemOutput {
  return {
    project,
    item_result: createItemResult(item, {
      status: "skipped",
      reason,
      skip_reason: skipReason,
    }),
  };
}

function createItemResult(
  item: ProbePlanItem,
  input: CreateItemResultInput,
): ProbePlanRunnerItemResult {
  const result: ProbePlanRunnerItemResult = {
    schema_version: PROBE_PLAN_RUNNER_SCHEMA_VERSION,
    asset_id: item.asset_id,
    source_uri: item.source_uri,
    plan_status: item.status,
    status: input.status,
    reason: input.reason,
  };

  if (input.skip_reason !== undefined) result.skip_reason = input.skip_reason;
  if (input.request !== undefined) result.request = input.request;
  if (input.execution !== undefined) result.execution = input.execution;
  if (input.probe !== undefined) result.probe = input.probe;
  if (input.executor_receipt !== undefined) result.executor_receipt = input.executor_receipt;
  if (input.cache_write !== undefined) result.cache_write = input.cache_write;

  return result;
}

interface ProbePlanRunnerProgressController {
  batch_id: string;
  created_at: string;
  collect_batch: boolean;
  include_queued_events: boolean;
  include_running_events: boolean;
  include_cached_events: boolean;
  events: ProbeProgressEvent[];
  handler?: ProbePlanRunnerProgressHandler | undefined;
}

interface CreateProgressEventForPlanItemInput {
  event_type: ProbeProgressEventType;
  message: string;
  created_at: string;
  request_id?: string | undefined;
  reason?: string | undefined;
}

function createProgressController(
  input: RunProbePlanWithRunnerInput,
  createdAt: string,
): ProbePlanRunnerProgressController | undefined {
  const collectBatch = input.include_progress_batch ?? false;
  if (!collectBatch && input.on_progress_event === undefined) return undefined;

  const controller: ProbePlanRunnerProgressController = {
    batch_id: input.progress_batch_id ?? `probe_progress_${safeId(input.plan.plan_id)}`,
    created_at: input.progress_created_at ?? createdAt,
    collect_batch: collectBatch,
    include_queued_events: input.include_queued_progress_events ?? true,
    include_running_events: input.include_running_progress_events ?? true,
    include_cached_events: input.include_cached_progress_events ?? true,
    events: [],
  };
  if (input.on_progress_event !== undefined) controller.handler = input.on_progress_event;
  return controller;
}

async function emitPlanItemProgress(
  progress: ProbePlanRunnerProgressController,
  plan: ProbePlan,
  runnerId: string,
  item: ProbePlanItem | ProbePlanRunnerItemResult,
  input: CreateProgressEventForPlanItemInput,
): Promise<void> {
  const eventInput = {
    batch_id: progress.batch_id,
    project_id: plan.project_id,
    plan_id: plan.plan_id,
    runner_id: runnerId,
    asset_id: item.asset_id,
    source_uri: item.source_uri,
    event_type: input.event_type,
    message: input.message,
    created_at: input.created_at,
  };
  if (input.request_id !== undefined) Object.assign(eventInput, { request_id: input.request_id });
  if (input.reason !== undefined) Object.assign(eventInput, { reason: input.reason });

  await emitProgressEvent(progress, createProbeProgressEvent(eventInput));
}

async function emitTerminalProgressForRunnerItem(
  progress: ProbePlanRunnerProgressController,
  plan: ProbePlan,
  runnerId: string,
  item: ProbePlanRunnerItemResult,
): Promise<void> {
  const terminalTime = item.probe?.probed_at ?? item.execution?.ended_at ?? progress.created_at;
  const requestId = item.request?.request_id;

  if (item.status === "applied") {
    await emitPlanItemProgress(progress, plan, runnerId, item, {
      event_type: "applied",
      message: `Probe metadata applied for ${item.asset_id}.`,
      created_at: terminalTime,
      request_id: requestId,
      reason: item.reason,
    });

    if (progress.include_cached_events && item.cache_write !== undefined) {
      await emitPlanItemProgress(progress, plan, runnerId, item, {
        event_type: "cached",
        message: `Probe metadata cached for ${item.asset_id}.`,
        created_at: terminalTime,
        request_id: requestId,
        reason: item.cache_write.record.cache_key,
      });
    }
    return;
  }

  if (item.status === "failed") {
    await emitPlanItemProgress(progress, plan, runnerId, item, {
      event_type: "failed",
      message: `Probe failed for ${item.asset_id}.`,
      created_at: terminalTime,
      request_id: requestId,
      reason: item.reason,
    });
    return;
  }

  if (item.plan_status === "cache-hit" && progress.include_cached_events) {
    await emitPlanItemProgress(progress, plan, runnerId, item, {
      event_type: "cached",
      message: `Probe cache hit available for ${item.asset_id}.`,
      created_at: terminalTime,
      request_id: requestId,
      reason: item.reason,
    });
    return;
  }

  await emitPlanItemProgress(progress, plan, runnerId, item, {
    event_type: "skipped",
    message: `Probe skipped for ${item.asset_id}.`,
    created_at: terminalTime,
    request_id: requestId,
    reason: item.reason,
  });
}

async function emitProgressEvent(
  progress: ProbePlanRunnerProgressController,
  event: ProbeProgressEvent,
): Promise<void> {
  if (progress.collect_batch) progress.events.push(event);
  if (progress.handler !== undefined) await progress.handler(event);
}

function inferFirstProgressEventTime(events: ProbeProgressEvent[]): string | undefined {
  return events[0]?.created_at;
}

function inferLastProgressEventTime(events: ProbeProgressEvent[]): string | undefined {
  return events.at(-1)?.created_at;
}

export function createProbePlanRunnerReceipt(
  plan: ProbePlan,
  runnerId: string,
  items: ProbePlanRunnerItemResult[],
  counts: ProbePlanRunnerCounts,
  createdAt = new Date().toISOString(),
): LedgerReceipt {
  return createReceipt({
    type: "media.probe.plan.runner.created",
    project_id: plan.project_id,
    source: "system",
    approved_by: "system",
    created_at: createdAt,
    payload: {
      plan_id: plan.plan_id,
      runner_id: runnerId,
      project_root_dir: plan.project_root_dir,
      item_count: counts.item_count,
      executed_count: counts.executed_count,
      applied_count: counts.applied_count,
      failed_count: counts.failed_count,
      skipped_count: counts.skipped_count,
      cached_count: counts.cached_count,
      items: items.map((item) => ({
        asset_id: item.asset_id,
        source_uri: item.source_uri,
        plan_status: item.plan_status,
        status: item.status,
        reason: item.reason,
        skip_reason: item.skip_reason ?? null,
        request_id: item.request?.request_id ?? null,
        execution_status: item.execution?.status ?? null,
        probe_status: item.probe?.status ?? null,
        cache_key: item.cache_write?.record.cache_key ?? null,
      })),
    },
  });
}

function createPlanRunnerRequestId(planId: string, assetId: string): string {
  return `probe_run_${safeId(planId)}_${safeId(assetId)}`;
}

function safeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}
