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
  | { type: "clip.added"; clip: TimelineClip }
  | { type: "clip.moved"; clip_id: string; track_id: string; timeline_start: number }
  | { type: "clip.trimmed"; clip_id: string; source: TimeRange; timeline: TimeRange }
  | { type: "clip.deleted"; clip_id: string };

export function createEmptyTimeline(): TimelineState {
  return { tracks: [] };
}

export function reduceTimeline(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case "track.created":
      return { ...state, tracks: [...state.tracks, action.track] };

    case "clip.added":
      return {
        ...state,
        tracks: state.tracks.map((track) =>
          track.track_id === action.clip.track_id
            ? { ...track, clips: [...track.clips, action.clip] }
            : track,
        ),
      };

    case "clip.moved":
      return mapClip(state, action.clip_id, (clip) => {
        const duration = clip.timeline.end - clip.timeline.start;
        return {
          ...clip,
          track_id: action.track_id,
          timeline: {
            start: action.timeline_start,
            end: action.timeline_start + duration,
          },
        };
      });

    case "clip.trimmed":
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
  }
}

export function createTrack(input: Omit<TimelineTrack, "clips"> & { clips?: TimelineClip[] }): TimelineTrack {
  return {
    ...input,
    clips: input.clips ?? [],
  };
}

export function createClip(input: TimelineClip): TimelineClip {
  if (input.timeline.end <= input.timeline.start) {
    throw new Error("Timeline clip must have positive timeline duration");
  }
  if (input.source.end <= input.source.start) {
    throw new Error("Timeline clip must have positive source duration");
  }
  return input;
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
      clips: track.clips.map((clip) => (clip.clip_id === clipId ? mapper(clip) : clip)),
    })),
  };
}
