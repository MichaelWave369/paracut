import type { RenderPlan } from "./index";

export interface ParallaxWaveForgeBridgeOptions {
  contentHash?: string | null;
  createdAt?: string;
  planRevision?: number;
}

export function renderPlanToWaveForgeBridge(
  plan: RenderPlan,
  options: ParallaxWaveForgeBridgeOptions = {},
) {
  const contentHash = options.contentHash ?? null;
  const createdAt = options.createdAt ?? plan.created_at;
  const planRevision = options.planRevision;
  if (planRevision !== undefined && (!Number.isInteger(planRevision) || planRevision < 1)) {
    throw new TypeError("planRevision must be a positive integer when supplied");
  }
  return {
    schema: "parallax.bridge.v1" as const,
    protocol: "parallax-bridge" as const,
    version: 1 as const,
    transferId: `paracut-waveforge:${plan.plan_id}`,
    source: "ParaCut",
    target: "WaveForgeStudio",
    createdAt,
    localOnly: true,
    payloadType: "application/vnd.paracut.render-plan+json",
    payloadRefOrInline: {
      native: plan,
    },
    contentHash,
    ...(planRevision !== undefined ? { planRevision } : {}),
    trustLabels: [],
    warnings: contentHash
      ? []
      : ["No render-plan content hash supplied by caller; native plan remains preserved."],
    compatibilityNotes: [
      "Reference-only handoff. WaveForgeStudio must not treat this bridge as render authorization.",
      ...(planRevision !== undefined
        ? ["planRevision is issuer-controlled monotonic freshness metadata; consumers still own accepted-revision state."]
        : []),
    ],
    lineageRef: null,
    requiresUserAction: true,
  };
}


export interface ParallaxCreativeLineageV2 {
  profile: "parallax.creative-interop.v2";
  sourceBridgeSchema: "parallax.bridge.v2";
  sourceTransferId: string;
  creativeManifestHash: string;
  baseContentHash: string;
  overlayContentHashes: string[];
  semanticOverlayCount: number;
  auralithCaptureHash?: string;
  auralithReceiptHash?: string;
  paraCutAssetHashes?: string[];
}

export interface ParallaxWaveForgeBridgeV2Options {
  contentHash: string;
  creativeLineage: ParallaxCreativeLineageV2;
  createdAt?: string;
  planRevision: number;
}

export function renderPlanToWaveForgeBridgeV2(
  plan: RenderPlan,
  options: ParallaxWaveForgeBridgeV2Options,
) {
  assertSha256(options.contentHash, "contentHash");
  assertCreativeLineageV2(options.creativeLineage);
  if (!Number.isInteger(options.planRevision) || options.planRevision < 1) {
    throw new TypeError("planRevision must be a positive integer for Parallax Creative Interop v2");
  }

  const createdAt = options.createdAt ?? plan.created_at;
  return {
    schema: "parallax.bridge.v2" as const,
    protocol: "parallax-bridge" as const,
    version: 2 as const,
    interopProfile: "parallax.creative-interop.v2" as const,
    transferId: "paracut-waveforge-v2:" + plan.plan_id,
    source: "ParaCut" as const,
    target: "WaveForgeStudio" as const,
    createdAt,
    localOnly: true,
    payloadType: "application/vnd.paracut.render-plan+json",
    payloadRefOrInline: {
      native: plan,
    },
    contentHash: options.contentHash.toLowerCase(),
    planRevision: options.planRevision,
    creativeLineage: normalizeCreativeLineage(options.creativeLineage),
    trustLabels: ["creative-lineage-bound"],
    warnings: [],
    compatibilityNotes: [
      "Reference-only handoff. WaveForgeStudio must not treat this bridge as render authorization.",
      "Creative lineage is provenance evidence only and grants no execution, publishing, rights, or release authority.",
      "planRevision is issuer-controlled monotonic freshness metadata; consumers own accepted-revision state.",
    ],
    lineageRef: options.creativeLineage.creativeManifestHash.toLowerCase(),
    requiresUserAction: true,
    authority: {
      realRenderingAuthorized: false,
      networkAuthorized: false,
      subprocessAuthorized: false,
      automaticImportAuthorized: false,
      publishAuthorized: false,
    },
  };
}

function assertCreativeLineageV2(lineage: ParallaxCreativeLineageV2): void {
  if (lineage.profile !== "parallax.creative-interop.v2") {
    throw new TypeError("creativeLineage.profile must be parallax.creative-interop.v2");
  }
  if (lineage.sourceBridgeSchema !== "parallax.bridge.v2") {
    throw new TypeError("creativeLineage.sourceBridgeSchema must be parallax.bridge.v2");
  }
  if (!lineage.sourceTransferId) {
    throw new TypeError("creativeLineage.sourceTransferId is required");
  }
  assertSha256(lineage.creativeManifestHash, "creativeLineage.creativeManifestHash");
  assertSha256(lineage.baseContentHash, "creativeLineage.baseContentHash");
  if (!Array.isArray(lineage.overlayContentHashes) || lineage.overlayContentHashes.length !== lineage.semanticOverlayCount) {
    throw new TypeError("creativeLineage overlay hash count must match semanticOverlayCount");
  }
  if (!Number.isInteger(lineage.semanticOverlayCount) || lineage.semanticOverlayCount < 0 || lineage.semanticOverlayCount > 16) {
    throw new TypeError("creativeLineage.semanticOverlayCount must be an integer from 0 to 16");
  }
  for (const hash of lineage.overlayContentHashes) assertSha256(hash, "creativeLineage.overlayContentHashes");
  if (lineage.auralithCaptureHash !== undefined) assertSha256(lineage.auralithCaptureHash, "creativeLineage.auralithCaptureHash");
  if (lineage.auralithReceiptHash !== undefined) assertSha256(lineage.auralithReceiptHash, "creativeLineage.auralithReceiptHash");
  if (lineage.paraCutAssetHashes !== undefined) {
    for (const hash of lineage.paraCutAssetHashes) assertSha256(hash, "creativeLineage.paraCutAssetHashes");
  }
}

function normalizeCreativeLineage(lineage: ParallaxCreativeLineageV2): ParallaxCreativeLineageV2 {
  return {
    ...lineage,
    creativeManifestHash: lineage.creativeManifestHash.toLowerCase(),
    baseContentHash: lineage.baseContentHash.toLowerCase(),
    overlayContentHashes: lineage.overlayContentHashes.map((hash) => hash.toLowerCase()),
    ...(lineage.auralithCaptureHash ? { auralithCaptureHash: lineage.auralithCaptureHash.toLowerCase() } : {}),
    ...(lineage.auralithReceiptHash ? { auralithReceiptHash: lineage.auralithReceiptHash.toLowerCase() } : {}),
    ...(lineage.paraCutAssetHashes
      ? { paraCutAssetHashes: lineage.paraCutAssetHashes.map((hash) => hash.toLowerCase()) }
      : {}),
  };
}

function assertSha256(value: string, label: string): void {
  if (!/^sha256:[0-9a-fA-F]{64}$/.test(String(value))) {
    throw new TypeError(label + " must be sha256:<64 hex>");
  }
}
