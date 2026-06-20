import type { ProbePlanRunnerItemResult, ProbePlanRunnerResult } from "../../probe-plan-runner-core/src/index";

export const PROBE_PROGRESS_SCHEMA_VERSION = "paracut.probe-progress.v0" as const;

export type ProbeProgressEventType = "queued" | "running" | "applied" | "cached" | "failed" | "skipped";

export interface ProbeProgressEvent {
  schema_version: typeof PROBE_PROGRESS_SCHEMA_VERSION;
  event_id: string;
  batch_id: string;
  project_id: string;
  event_type: ProbeProgressEventType;
  message: string;
  created_at: string;
  plan_id?: string;
  runner_id?: string;
  asset_id?: string;
  source_uri?: string;
  request_id?: string;
  reason?: string;
}

export interface CreateProbeProgressEventInput {
  batch_id: string;
  project_id: string;
  event_type: ProbeProgressEventType;
  message: string;
  created_at?: string | undefined;
  event_id?: string | undefined;
  plan_id?: string | undefined;
  runner_id?: string | undefined;
  asset_id?: string | undefined;
  source_uri?: string | undefined;
  request_id?: string | undefined;
  reason?: string | undefined;
}

export interface ProbeProgressCounts {
  event_count: number;
  asset_count: number;
  queued_count: number;
  running_count: number;
  applied_count: number;
  cached_count: number;
  failed_count: number;
  skipped_count: number;
  terminal_count: number;
}

export interface ProbeProgressBatch {
  schema_version: typeof PROBE_PROGRESS_SCHEMA_VERSION;
  batch_id: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  events: ProbeProgressEvent[];
  counts: ProbeProgressCounts;
  plan_id?: string;
  runner_id?: string;
}

export interface CreateProbeProgressBatchInput {
  batch_id: string;
  project_id: string;
  events: ProbeProgressEvent[];
  created_at?: string | undefined;
  updated_at?: string | undefined;
  plan_id?: string | undefined;
  runner_id?: string | undefined;
}

export interface CreateProgressEventsFromPlanRunnerResultOptions {
  batch_id?: string | undefined;
  created_at?: string | undefined;
  include_queued_events?: boolean | undefined;
  include_running_events?: boolean | undefined;
  include_cached_events?: boolean | undefined;
}

export function createProbeProgressEvent(input: CreateProbeProgressEventInput): ProbeProgressEvent {
  if (input.batch_id.trim().length === 0) throw new Error("Probe progress batch_id is required");
  if (input.project_id.trim().length === 0) throw new Error("Probe progress project_id is required");
  if (input.message.trim().length === 0) throw new Error("Probe progress message is required");

  const createdAt = input.created_at ?? new Date().toISOString();
  const event: ProbeProgressEvent = {
    schema_version: PROBE_PROGRESS_SCHEMA_VERSION,
    event_id: input.event_id ?? createProbeProgressEventId(input.batch_id, input.event_type, input.asset_id, createdAt),
    batch_id: input.batch_id,
    project_id: input.project_id,
    event_type: input.event_type,
    message: input.message,
    created_at: createdAt,
  };

  if (input.plan_id !== undefined) event.plan_id = input.plan_id;
  if (input.runner_id !== undefined) event.runner_id = input.runner_id;
  if (input.asset_id !== undefined) event.asset_id = input.asset_id;
  if (input.source_uri !== undefined) event.source_uri = input.source_uri;
  if (input.request_id !== undefined) event.request_id = input.request_id;
  if (input.reason !== undefined) event.reason = input.reason;

  return event;
}

export function createProbeProgressBatch(input: CreateProbeProgressBatchInput): ProbeProgressBatch {
  if (input.batch_id.trim().length === 0) throw new Error("Probe progress batch_id is required");
  if (input.project_id.trim().length === 0) throw new Error("Probe progress project_id is required");

  const createdAt = input.created_at ?? inferFirstEventTime(input.events) ?? new Date().toISOString();
  const updatedAt = input.updated_at ?? inferLastEventTime(input.events) ?? createdAt;
  const batch: ProbeProgressBatch = {
    schema_version: PROBE_PROGRESS_SCHEMA_VERSION,
    batch_id: input.batch_id,
    project_id: input.project_id,
    created_at: createdAt,
    updated_at: updatedAt,
    events: input.events,
    counts: summarizeProbeProgressEvents(input.events),
  };

  if (input.plan_id !== undefined) batch.plan_id = input.plan_id;
  if (input.runner_id !== undefined) batch.runner_id = input.runner_id;

  return batch;
}

export function summarizeProbeProgressEvents(events: ProbeProgressEvent[]): ProbeProgressCounts {
  const assetIds = new Set<string>();
  for (const event of events) {
    if (event.asset_id !== undefined) assetIds.add(event.asset_id);
  }

  return {
    event_count: events.length,
    asset_count: assetIds.size,
    queued_count: countEvents(events, "queued"),
    running_count: countEvents(events, "running"),
    applied_count: countEvents(events, "applied"),
    cached_count: countEvents(events, "cached"),
    failed_count: countEvents(events, "failed"),
    skipped_count: countEvents(events, "skipped"),
    terminal_count: events.filter((event) => isTerminalProbeProgressEvent(event.event_type)).length,
  };
}

export function createProbeProgressEventsFromPlanRunnerResult(
  result: ProbePlanRunnerResult,
  options: CreateProgressEventsFromPlanRunnerResultOptions = {},
): ProbeProgressEvent[] {
  const batchId = options.batch_id ?? `probe_progress_${safeId(result.plan_id)}`;
  const createdAt = options.created_at ?? result.created_at;
  const includeQueued = options.include_queued_events ?? true;
  const includeRunning = options.include_running_events ?? true;
  const includeCached = options.include_cached_events ?? true;
  const events: ProbeProgressEvent[] = [];

  for (const item of result.items) {
    if (includeQueued) {
      events.push(createItemProgressEvent({
        result,
        item,
        batch_id: batchId,
        event_type: "queued",
        message: `Probe work queued for ${item.asset_id}.`,
        created_at: createdAt,
      }));
    }

    if (includeRunning && item.request !== undefined) {
      events.push(createItemProgressEvent({
        result,
        item,
        batch_id: batchId,
        event_type: "running",
        message: `Probe runner started for ${item.asset_id}.`,
        created_at: item.request.requested_at,
        request_id: item.request.request_id,
      }));
    }

    events.push(...createTerminalEventsForRunnerItem(result, item, batchId, createdAt, includeCached));
  }

  return events;
}

export function createProbeProgressBatchFromPlanRunnerResult(
  result: ProbePlanRunnerResult,
  options: CreateProgressEventsFromPlanRunnerResultOptions = {},
): ProbeProgressBatch {
  const batchId = options.batch_id ?? `probe_progress_${safeId(result.plan_id)}`;
  const events = createProbeProgressEventsFromPlanRunnerResult(result, { ...options, batch_id: batchId });
  return createProbeProgressBatch({
    batch_id: batchId,
    project_id: result.project_id,
    plan_id: result.plan_id,
    runner_id: result.runner_id,
    created_at: inferFirstEventTime(events) ?? result.created_at,
    updated_at: inferLastEventTime(events) ?? result.created_at,
    events,
  });
}

export function isTerminalProbeProgressEvent(eventType: ProbeProgressEventType): boolean {
  return eventType === "applied" || eventType === "cached" || eventType === "failed" || eventType === "skipped";
}

interface CreateItemProgressEventInput {
  result: ProbePlanRunnerResult;
  item: ProbePlanRunnerItemResult;
  batch_id: string;
  event_type: ProbeProgressEventType;
  message: string;
  created_at: string;
  request_id?: string | undefined;
  reason?: string | undefined;
}

function createItemProgressEvent(input: CreateItemProgressEventInput): ProbeProgressEvent {
  return createProbeProgressEvent({
    batch_id: input.batch_id,
    project_id: input.result.project_id,
    plan_id: input.result.plan_id,
    runner_id: input.result.runner_id,
    asset_id: input.item.asset_id,
    source_uri: input.item.source_uri,
    event_type: input.event_type,
    message: input.message,
    created_at: input.created_at,
    request_id: input.request_id,
    reason: input.reason,
  });
}

function createTerminalEventsForRunnerItem(
  result: ProbePlanRunnerResult,
  item: ProbePlanRunnerItemResult,
  batchId: string,
  createdAt: string,
  includeCached: boolean,
): ProbeProgressEvent[] {
  const events: ProbeProgressEvent[] = [];
  const terminalTime = item.probe?.probed_at ?? item.execution?.ended_at ?? createdAt;
  const requestId = item.request?.request_id;

  if (item.status === "applied") {
    events.push(createItemProgressEvent({
      result,
      item,
      batch_id: batchId,
      event_type: "applied",
      message: `Probe metadata applied for ${item.asset_id}.`,
      created_at: terminalTime,
      request_id: requestId,
      reason: item.reason,
    }));

    if (includeCached && item.cache_write !== undefined) {
      events.push(createItemProgressEvent({
        result,
        item,
        batch_id: batchId,
        event_type: "cached",
        message: `Probe metadata cached for ${item.asset_id}.`,
        created_at: terminalTime,
        request_id: requestId,
        reason: item.cache_write.record.cache_key,
      }));
    }
    return events;
  }

  if (item.status === "failed") {
    events.push(createItemProgressEvent({
      result,
      item,
      batch_id: batchId,
      event_type: "failed",
      message: `Probe failed for ${item.asset_id}.`,
      created_at: terminalTime,
      request_id: requestId,
      reason: item.reason,
    }));
    return events;
  }

  if (item.plan_status === "cache-hit" && includeCached) {
    events.push(createItemProgressEvent({
      result,
      item,
      batch_id: batchId,
      event_type: "cached",
      message: `Probe cache hit available for ${item.asset_id}.`,
      created_at: terminalTime,
      request_id: requestId,
      reason: item.reason,
    }));
    return events;
  }

  events.push(createItemProgressEvent({
    result,
    item,
    batch_id: batchId,
    event_type: "skipped",
    message: `Probe skipped for ${item.asset_id}.`,
    created_at: terminalTime,
    request_id: requestId,
    reason: item.reason,
  }));
  return events;
}

function countEvents(events: ProbeProgressEvent[], eventType: ProbeProgressEventType): number {
  return events.filter((event) => event.event_type === eventType).length;
}

function inferFirstEventTime(events: ProbeProgressEvent[]): string | undefined {
  return events[0]?.created_at;
}

function inferLastEventTime(events: ProbeProgressEvent[]): string | undefined {
  return events.at(-1)?.created_at;
}

function createProbeProgressEventId(
  batchId: string,
  eventType: ProbeProgressEventType,
  assetId: string | undefined,
  createdAt: string,
): string {
  const assetPart = assetId === undefined ? "batch" : safeId(assetId);
  return `probe_progress_${safeId(batchId)}_${safeId(eventType)}_${assetPart}_${safeId(createdAt)}`;
}

function safeId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "item";
}
