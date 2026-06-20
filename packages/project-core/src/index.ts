import {
  appendReceipt,
  createReceipt,
  fromJsonLine,
  toJsonLine,
  type LedgerReceipt,
  type ReceiptSource,
} from "../../ledger-core/src/index";
import {
  addMediaAsset,
  createEmptyMediaLibrary,
  createMediaAsset,
  type ImportMediaInput,
  type MediaAsset,
  type MediaLibrary,
} from "../../media-core/src/index";
import {
  createClip,
  createEmptyTimeline,
  createTrack,
  reduceTimeline,
  validateTimeline,
  type TimeRange,
  type TimelineClip,
  type TimelineState,
  type TimelineTrack,
  type TrackKind,
} from "../../timeline-core/src/index";
import {
  createRenderJob,
  createRenderPlan,
  type CreateRenderJobInput,
  type RenderJob,
  type RenderPlan,
} from "../../render-core/src/index";

export interface ParaCutProject {
  project_id: string;
  name: string;
  schema_version: "paracut.project.v0";
  created_at: string;
  updated_at: string;
  media: MediaLibrary;
  timeline: TimelineState;
  ledger: LedgerReceipt[];
  render_jobs: RenderJob[];
  metadata: Record<string, unknown>;
}

export interface CreateProjectInput {
  project_id: string;
  name: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface AddTrackInput {
  track_id: string;
  kind: TrackKind;
  name: string;
  locked?: boolean;
  muted?: boolean;
}

export interface AddClipInput {
  clip_id: string;
  asset_id: string;
  track_id: string;
  timeline: TimeRange;
  source: TimeRange;
}

export type QueueRenderJobInput = Omit<CreateRenderJobInput, "project_id">;

export interface PlanRenderJobResult {
  project: ParaCutProject;
  plan: RenderPlan;
}

interface RecordProjectEventOptions {
  source?: ReceiptSource;
  created_at?: string;
}

export function createProject(input: CreateProjectInput): ParaCutProject {
  if (!input.project_id) throw new Error("Project requires project_id");
  if (!input.name) throw new Error("Project requires name");

  const now = input.created_at ?? new Date().toISOString();
  const initial: ParaCutProject = {
    project_id: input.project_id,
    name: input.name,
    schema_version: "paracut.project.v0",
    created_at: now,
    updated_at: now,
    media: createEmptyMediaLibrary(),
    timeline: createEmptyTimeline(),
    ledger: [],
    render_jobs: [],
    metadata: input.metadata ?? {},
  };

  return recordProjectEvent(
    initial,
    "project.created",
    {
      name: input.name,
      metadata: initial.metadata,
    },
    { source: "system", created_at: now },
  );
}

export function importMediaToProject(project: ParaCutProject, input: ImportMediaInput): ParaCutProject {
  const asset = createMediaAsset(input);
  const next: ParaCutProject = {
    ...project,
    media: addMediaAsset(project.media, asset),
  };

  return recordProjectEvent(
    next,
    "media.imported",
    {
      asset_id: asset.asset_id,
      kind: asset.kind,
      name: asset.name,
      uri: asset.uri,
      duration_seconds: asset.duration_seconds ?? null,
      rights_note: asset.rights_note ?? null,
    },
    { source: "import" },
  );
}

export function addTrackToProject(project: ParaCutProject, input: AddTrackInput): ParaCutProject {
  const track: TimelineTrack = createTrack({
    track_id: input.track_id,
    kind: input.kind,
    name: input.name,
    ...(input.locked !== undefined ? { locked: input.locked } : {}),
    ...(input.muted !== undefined ? { muted: input.muted } : {}),
  });

  const timeline = reduceTimeline(project.timeline, { type: "track.created", track });
  validateTimeline(timeline);

  return recordProjectEvent({ ...project, timeline }, "track.created", {
    track_id: track.track_id,
    kind: track.kind,
    name: track.name,
  });
}

export function addClipToProject(project: ParaCutProject, input: AddClipInput): ParaCutProject {
  assertAssetExists(project, input.asset_id);

  const clip: TimelineClip = createClip({
    clip_id: input.clip_id,
    asset_id: input.asset_id,
    track_id: input.track_id,
    timeline: input.timeline,
    source: input.source,
    enabled: true,
    effects: [],
  });

  const timeline = reduceTimeline(project.timeline, { type: "clip.added", clip });
  validateTimeline(timeline);

  return recordProjectEvent({ ...project, timeline }, "clip.added", {
    clip_id: clip.clip_id,
    asset_id: clip.asset_id,
    track_id: clip.track_id,
    timeline: clip.timeline,
    source: clip.source,
  });
}

export function moveClipInProject(
  project: ParaCutProject,
  clipId: string,
  trackId: string,
  timelineStart: number,
): ParaCutProject {
  const timeline = reduceTimeline(project.timeline, {
    type: "clip.moved",
    clip_id: clipId,
    track_id: trackId,
    timeline_start: timelineStart,
  });
  validateTimeline(timeline);

  return recordProjectEvent({ ...project, timeline }, "clip.moved", {
    clip_id: clipId,
    track_id: trackId,
    timeline_start: timelineStart,
  });
}

export function trimClipInProject(
  project: ParaCutProject,
  clipId: string,
  source: TimeRange,
  timelineRange: TimeRange,
): ParaCutProject {
  const timeline = reduceTimeline(project.timeline, {
    type: "clip.trimmed",
    clip_id: clipId,
    source,
    timeline: timelineRange,
  });
  validateTimeline(timeline);

  return recordProjectEvent({ ...project, timeline }, "clip.trimmed", {
    clip_id: clipId,
    source,
    timeline: timelineRange,
  });
}

export function splitClipInProject(
  project: ParaCutProject,
  clipId: string,
  at: number,
  leftClipId: string,
  rightClipId: string,
): ParaCutProject {
  const timeline = reduceTimeline(project.timeline, {
    type: "clip.split",
    clip_id: clipId,
    at,
    left_clip_id: leftClipId,
    right_clip_id: rightClipId,
  });
  validateTimeline(timeline);

  return recordProjectEvent({ ...project, timeline }, "clip.split", {
    clip_id: clipId,
    at,
    left_clip_id: leftClipId,
    right_clip_id: rightClipId,
  });
}

export function deleteClipFromProject(project: ParaCutProject, clipId: string): ParaCutProject {
  const timeline = reduceTimeline(project.timeline, { type: "clip.deleted", clip_id: clipId });
  validateTimeline(timeline);

  return recordProjectEvent({ ...project, timeline }, "clip.deleted", {
    clip_id: clipId,
  });
}

export function queueRenderJobForProject(project: ParaCutProject, input: QueueRenderJobInput): ParaCutProject {
  const job = createRenderJob({
    ...input,
    project_id: project.project_id,
  });

  return recordProjectEvent(
    {
      ...project,
      render_jobs: [...project.render_jobs, job],
    },
    "render.queued",
    {
      job_id: job.job_id,
      output_uri: job.output_uri,
      preset_id: job.preset.preset_id,
    },
    { source: "render" },
  );
}

export function planRenderJobForProject(
  project: ParaCutProject,
  jobId: string,
  createdAt = new Date().toISOString(),
): PlanRenderJobResult {
  const job = getRenderJobOrThrow(project, jobId);
  const plan = createRenderPlan(job, project.timeline, project.media, createdAt);
  const next = recordProjectEvent(
    project,
    "render.plan.created",
    {
      job_id: job.job_id,
      plan_id: plan.plan_id,
      preset_id: plan.preset.preset_id,
      output_uri: plan.output_uri,
      duration_seconds: plan.duration_seconds,
      input_count: plan.inputs.length,
      clip_count: plan.clips.length,
      warning_count: plan.warnings.length,
    },
    { source: "render", created_at: createdAt },
  );

  return { project: next, plan };
}

export function getProjectMedia(project: ParaCutProject, assetId: string): MediaAsset | undefined {
  return project.media.assets.find((asset) => asset.asset_id === assetId);
}

export function serializeProject(project: ParaCutProject): string {
  assertProject(project);
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function parseProject(json: string): ParaCutProject {
  const parsed = JSON.parse(json) as unknown;
  assertProject(parsed);
  return parsed;
}

export function serializeProjectReceipts(project: ParaCutProject): string {
  return `${project.ledger.map(toJsonLine).join("\n")}\n`;
}

export function parseProjectReceipts(jsonl: string): LedgerReceipt[] {
  return jsonl
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(fromJsonLine);
}

export function assertProject(value: unknown): asserts value is ParaCutProject {
  const candidate = value as Partial<ParaCutProject>;
  if (!candidate.project_id) throw new Error("Project missing project_id");
  if (!candidate.name) throw new Error("Project missing name");
  if (candidate.schema_version !== "paracut.project.v0") {
    throw new Error("Unsupported ParaCut project schema version");
  }
  if (!candidate.created_at) throw new Error("Project missing created_at");
  if (!candidate.updated_at) throw new Error("Project missing updated_at");
  if (!candidate.media || !Array.isArray(candidate.media.assets)) {
    throw new Error("Project media library is invalid");
  }
  if (!candidate.timeline || !Array.isArray(candidate.timeline.tracks)) {
    throw new Error("Project timeline is invalid");
  }
  if (!Array.isArray(candidate.ledger)) throw new Error("Project ledger is invalid");
  if (!Array.isArray(candidate.render_jobs)) throw new Error("Project render_jobs is invalid");
  validateTimeline(candidate.timeline);
}

function recordProjectEvent(
  project: ParaCutProject,
  type: string,
  payload: Record<string, unknown>,
  options: RecordProjectEventOptions = {},
): ParaCutProject {
  const createdAt = options.created_at ?? new Date().toISOString();
  const receipt = createReceipt({
    type,
    project_id: project.project_id,
    source: options.source ?? "manual",
    approved_by: "human",
    created_at: createdAt,
    payload,
  });

  return {
    ...project,
    updated_at: createdAt,
    ledger: appendReceipt(project.ledger, receipt),
  };
}

function assertAssetExists(project: ParaCutProject, assetId: string): void {
  if (!getProjectMedia(project, assetId)) {
    throw new Error(`Media asset not found: ${assetId}`);
  }
}

function getRenderJobOrThrow(project: ParaCutProject, jobId: string): RenderJob {
  const job = project.render_jobs.find((candidate) => candidate.job_id === jobId);
  if (!job) throw new Error(`Render job not found: ${jobId}`);
  return job;
}
