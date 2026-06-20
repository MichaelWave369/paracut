export type AssetKind = "video" | "audio" | "image" | "subtitle" | "project";

export interface MediaHash {
  algorithm: "sha256" | "sha1" | "md5" | "unknown";
  value: string;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  sample_rate?: number;
  channels?: number;
  bitrate?: number;
}

export interface MediaAsset {
  asset_id: string;
  kind: AssetKind;
  name: string;
  uri: string;
  duration_seconds?: number;
  hash?: MediaHash;
  metadata?: MediaMetadata;
  rights_note?: string;
  imported_at: string;
}

export interface ImportMediaInput {
  asset_id: string;
  kind: AssetKind;
  name: string;
  uri: string;
  duration_seconds?: number;
  metadata?: MediaMetadata;
  rights_note?: string;
  imported_at?: string;
}

export function createMediaAsset(input: ImportMediaInput): MediaAsset {
  return {
    asset_id: input.asset_id,
    kind: input.kind,
    name: input.name,
    uri: input.uri,
    duration_seconds: input.duration_seconds,
    metadata: input.metadata,
    rights_note:
      input.rights_note ?? "User imported media. Rights not verified by ParaCut.",
    imported_at: input.imported_at ?? new Date().toISOString(),
  };
}

export function attachHash(asset: MediaAsset, hash: MediaHash): MediaAsset {
  return {
    ...asset,
    hash,
  };
}

export function isVideoAsset(asset: MediaAsset): boolean {
  return asset.kind === "video";
}

export function isAudioAsset(asset: MediaAsset): boolean {
  return asset.kind === "audio";
}
