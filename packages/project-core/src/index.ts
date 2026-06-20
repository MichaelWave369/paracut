import { appendReceipt, createReceipt, type LedgerReceipt } from "../../ledger-core/src/index";
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
  type CreateRenderJobInput,
  type RenderJob,
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

  return recordProjectEvent(initial, "project.created", {
    name: input.name,
    metadata: initial.metadata,
  }, now);
}

export function importMediaToProject(project: ParaCutProject, input: ImportMediaInput): ParaCutProject {
  const asset = createMediaAsset(input);
  const next: ParaCutProject = {
    ...project,
    media: addMediaAsset(project.media, asset),
  };

  return recordProjectEvent(next, "media.imported", {
    asset_id: asset.asset_id,
    kind: asset.kind,
    name: asset.name,
    uri: asset.uri,
    duration_seconds: asset.duration_seconds ?? null,
    rights_note: asset.rights_note ?? null,
  });
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

export function queueRenderJobForProject(project: ParaCutProject, input: CreateRenderJobInput): ParaCutProject {
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
  );
}

export function getProjectMedia(project: ParaCutProject, assetId: string): MediaAsset | undefined {
  return project.media.assets.find((asset) => asset.asset_id === assetId);
}

export function serializeProject(project: ParaCutProject): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

function recordProjectEvent(
  project: ParaCutProject,
  type: string,
  payload: Record<string, unknown>,
  createdAt = new Date().toISOString(),
): ParaCutProject {
  const receipt = createReceipt({
    type,
    project_id: project.project_id,
    source: "manual",
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
