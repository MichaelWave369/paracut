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
  hash?: MediaHash;
  metadata?: MediaMetadata;
  rights_note?: string;
  imported_at?: string;
}

export interface MediaLibrary {
  assets: MediaAsset[];
}

export function createEmptyMediaLibrary(): MediaLibrary {
  return { assets: [] };
}

export function createMediaAsset(input: ImportMediaInput): MediaAsset {
  if (!input.asset_id) throw new Error("Media asset requires asset_id");
  if (!input.name) throw new Error("Media asset requires name");
  if (!input.uri) throw new Error("Media asset requires uri");
  if (input.duration_seconds !== undefined && input.duration_seconds < 0) {
    throw new Error("Media asset duration cannot be negative");
  }

  const asset: MediaAsset = {
    asset_id: input.asset_id,
    kind: input.kind,
    name: input.name,
    uri: input.uri,
    imported_at: input.imported_at ?? new Date().toISOString(),
  };

  if (input.duration_seconds !== undefined) asset.duration_seconds = input.duration_seconds;
  if (input.hash !== undefined) asset.hash = input.hash;
  if (input.metadata !== undefined) asset.metadata = input.metadata;
  asset.rights_note = input.rights_note ?? "User imported media. Rights not verified by ParaCut.";

  return asset;
}

export function addMediaAsset(library: MediaLibrary, asset: MediaAsset): MediaLibrary {
  if (library.assets.some((candidate) => candidate.asset_id === asset.asset_id)) {
    throw new Error(`Duplicate asset_id: ${asset.asset_id}`);
  }
  return { assets: [...library.assets, asset] };
}

export function getMediaAsset(library: MediaLibrary, assetId: string): MediaAsset | undefined {
  return library.assets.find((asset) => asset.asset_id === assetId);
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

export function isVisualAsset(asset: MediaAsset): boolean {
  return asset.kind === "video" || asset.kind === "image";
}
