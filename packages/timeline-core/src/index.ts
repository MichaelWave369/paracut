export type TrackKind = "video" | "audio" | "caption" | "text" | "effect";

export interface TimeRange {
  start: number;
  end: number;
}

export interface TimelineEffect {
  effect_id: string;
  kind: string;
  enabled: boolean;
  params: Record<string, unknown>;
}

export interface TimelineClip {
  clip_id: string;
  asset_id: string;
  track_id: string;
  timeline: TimeRange;
  source: TimeRange;
  enabled: boolean;
  effects: TimelineEffect[];
}

export interface TimelineTrack {
  track_id: string;
  kind: TrackKind;
  name: string;
  clips: TimelineClip[];
  locked?: boolean;
  muted?: boolean;
}

export interface TimelineState {
  tracks: TimelineTrack[];
}

export type TimelineAction =
  | { type: "track.created"; track: TimelineTrack }
  | { type: "track.deleted"; track_id: string }
  | { type: "clip.added"; clip: TimelineClip }
  | { type: "clip.moved"; clip_id: string; track_id: string; timeline_start: number }
  | { type: "clip.trimmed"; clip_id: string; source: TimeRange; timeline: TimeRange }
  | { type: "clip.deleted"; clip_id: string }
  | { type: "clip.split"; clip_id: string; at: number; left_clip_id: string; right_clip_id: string };

export function createEmptyTimeline(): TimelineState {
  return { tracks: [] };
}

export function reduceTimeline(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case "track.created":
      assertUniqueTrackId(state, action.track.track_id);
      return { ...state, tracks: [...state.tracks, action.track] };

    case "track.deleted":
      return {
        ...state,
        tracks: state.tracks.filter((track) => track.track_id !== action.track_id),
      };

    case "clip.added":
      assertTrackExists(state, action.clip.track_id);
      assertUniqueClipId(state, action.clip.clip_id);
      return {
        ...state,
        tracks: state.tracks.map((track) =>
          track.track_id === action.clip.track_id
            ? { ...track, clips: sortClips([...track.clips, action.clip]) }
            : track,
        ),
      };

    case "clip.moved": {
      assertTrackExists(state, action.track_id);
      const clip = getClipOrThrow(state, action.clip_id);
      const duration = getRangeDuration(clip.timeline);
      const moved: TimelineClip = {
        ...clip,
        track_id: action.track_id,
        timeline: {
          start: action.timeline_start,
          end: action.timeline_start + duration,
        },
      };

      return {
        ...state,
        tracks: state.tracks.map((track) => {
          const withoutClip = track.clips.filter((candidate) => candidate.clip_id !== action.clip_id);
          if (track.track_id === action.track_id) {
            return { ...track, clips: sortClips([...withoutClip, moved]) };
          }
          return { ...track, clips: withoutClip };
        }),
      };
    }

    case "clip.trimmed":
      assertPositiveRange(action.source, "source");
      assertPositiveRange(action.timeline, "timeline");
      return mapClip(state, action.clip_id, (clip) => ({
        ...clip,
        source: action.source,
        timeline: action.timeline,
      }));

    case "clip.deleted":
      return {
        ...state,
        tracks: state.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((clip) => clip.clip_id !== action.clip_id),
        })),
      };

    case "clip.split":
      return splitClipAt(state, action.clip_id, action.at, action.left_clip_id, action.right_clip_id);
  }
}

export function createTrack(input: Omit<TimelineTrack, "clips"> & { clips?: TimelineClip[] }): TimelineTrack {
  return {
    ...input,
    clips: input.clips ?? [],
  };
}

export function createClip(input: TimelineClip): TimelineClip {
  assertPositiveRange(input.timeline, "timeline");
  assertPositiveRange(input.source, "source");
  return {
    ...input,
    effects: input.effects ?? [],
  };
}

export function getTimelineDuration(state: TimelineState): number {
  return state.tracks.reduce((maxDuration, track) => {
    const trackDuration = track.clips.reduce(
      (maxClipEnd, clip) => Math.max(maxClipEnd, clip.timeline.end),
      0,
    );
    return Math.max(maxDuration, trackDuration);
  }, 0);
}

export function getTrack(state: TimelineState, trackId: string): TimelineTrack | undefined {
  return state.tracks.find((track) => track.track_id === trackId);
}

export function getClip(state: TimelineState, clipId: string): TimelineClip | undefined {
  for (const track of state.tracks) {
    const clip = track.clips.find((candidate) => candidate.clip_id === clipId);
    if (clip) return clip;
  }
  return undefined;
}

export function splitClipAt(
  state: TimelineState,
  clipId: string,
  at: number,
  leftClipId: string,
  rightClipId: string,
): TimelineState {
  assertUniqueClipId(state, leftClipId);
  assertUniqueClipId(state, rightClipId);

  const original = getClipOrThrow(state, clipId);
  if (at <= original.timeline.start || at >= original.timeline.end) {
    throw new Error("Split point must be inside the clip timeline range");
  }

  const sourceOffset = at - original.timeline.start;
  const sourceSplit = original.source.start + sourceOffset;

  const left = createClip({
    ...original,
    clip_id: leftClipId,
    timeline: { start: original.timeline.start, end: at },
    source: { start: original.source.start, end: sourceSplit },
  });

  const right = createClip({
    ...original,
    clip_id: rightClipId,
    timeline: { start: at, end: original.timeline.end },
    source: { start: sourceSplit, end: original.source.end },
  });

  return {
    ...state,
    tracks: state.tracks.map((track) => {
      if (track.track_id !== original.track_id) return track;
      return {
        ...track,
        clips: sortClips([
          ...track.clips.filter((clip) => clip.clip_id !== clipId),
          left,
          right,
        ]),
      };
    }),
  };
}

export function validateTimeline(state: TimelineState): void {
  const trackIds = new Set<string>();
  const clipIds = new Set<string>();

  for (const track of state.tracks) {
    if (trackIds.has(track.track_id)) throw new Error(`Duplicate track_id: ${track.track_id}`);
    trackIds.add(track.track_id);

    for (const clip of track.clips) {
      if (clipIds.has(clip.clip_id)) throw new Error(`Duplicate clip_id: ${clip.clip_id}`);
      if (clip.track_id !== track.track_id) {
        throw new Error(`Clip ${clip.clip_id} is stored on ${track.track_id} but points to ${clip.track_id}`);
      }
      assertPositiveRange(clip.timeline, "timeline");
      assertPositiveRange(clip.source, "source");
      clipIds.add(clip.clip_id);
    }
  }
}

function sortClips(clips: TimelineClip[]): TimelineClip[] {
  return [...clips].sort((a, b) => a.timeline.start - b.timeline.start);
}

function mapClip(
  state: TimelineState,
  clipId: string,
  mapper: (clip: TimelineClip) => TimelineClip,
): TimelineState {
  return {
    ...state,
    tracks: state.tracks.map((track) => ({
      ...track,
      clips: sortClips(track.clips.map((clip) => (clip.clip_id === clipId ? mapper(clip) : clip))),
    })),
  };
}

function getClipOrThrow(state: TimelineState, clipId: string): TimelineClip {
  const clip = getClip(state, clipId);
  if (!clip) throw new Error(`Clip not found: ${clipId}`);
  return clip;
}

function assertTrackExists(state: TimelineState, trackId: string): void {
  if (!getTrack(state, trackId)) throw new Error(`Track not found: ${trackId}`);
}

function assertUniqueTrackId(state: TimelineState, trackId: string): void {
  if (getTrack(state, trackId)) throw new Error(`Duplicate track_id: ${trackId}`);
}

function assertUniqueClipId(state: TimelineState, clipId: string): void {
  if (getClip(state, clipId)) throw new Error(`Duplicate clip_id: ${clipId}`);
}

function assertPositiveRange(range: TimeRange, label: string): void {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    throw new Error(`${label} range must be finite`);
  }
  if (range.end <= range.start) {
    throw new Error(`${label} range must have positive duration`);
  }
}

function getRangeDuration(range: TimeRange): number {
  return range.end - range.start;
}
