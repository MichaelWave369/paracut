import type { CreateMediaImportReferenceInput } from "./index";

export interface ParallaxCreativeBridgeV1 {
  schema: "parallax.bridge.v1";
  protocol: "parallax-bridge";
  version: 1;
  transferId: string;
  source: "Domistika";
  target: "Auralith369";
  createdAt: string;
  localOnly: boolean;
  payloadType: string;
  payloadRefOrInline: {
    native?: {
      protocol?: string;
      version?: number;
      source?: string;
      target?: string;
      createdAt?: string;
      name?: string;
      image?: string;
      canvas?: { width?: number; height?: number };
      note?: string;
    };
  };
  contentHash?: string | null;
  warnings?: string[];
  requiresUserAction: boolean;
}

export interface VerifyParallaxCreativeBridgeOptions {
  requireContentHash?: boolean;
}

export async function parallaxBridgeToMediaImportInput(
  bridge: ParallaxCreativeBridgeV1,
): Promise<CreateMediaImportReferenceInput> {
  await verifyParallaxCreativeBridgeContentHash(bridge);
  return projectParallaxBridgeToMediaImportInput(bridge);
}

export async function verifyParallaxCreativeBridgeContentHash(
  bridge: ParallaxCreativeBridgeV1,
  options: VerifyParallaxCreativeBridgeOptions = {},
): Promise<void> {
  assertCreativeBridgeEnvelope(bridge);

  const native = bridge.payloadRefOrInline?.native;
  const image = native?.image;
  if (!image || !image.startsWith("data:image/")) {
    throw new Error("Creative handoff requires a native data:image payload");
  }

  const contentHash = bridge.contentHash;
  if (!contentHash) {
    if (options.requireContentHash !== false) {
      throw new Error("Verified creative handoff requires contentHash");
    }
    return;
  }
  if (!/^sha256:[0-9a-fA-F]{64}$/.test(contentHash)) {
    throw new Error("Creative handoff contentHash must be sha256:<64 hex>");
  }

  const bytes = decodeBase64ImageDataUri(image);
  const digestInput = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(digestInput).set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestInput);
  const actual = bytesToHex(new Uint8Array(digest));
  const expected = contentHash.slice("sha256:".length).toLowerCase();
  if (actual !== expected) {
    throw new Error("Creative handoff contentHash does not match native image bytes");
  }
}

export async function verifiedParallaxBridgeToMediaImportInput(
  bridge: ParallaxCreativeBridgeV1,
): Promise<CreateMediaImportReferenceInput> {
  return parallaxBridgeToMediaImportInput(bridge);
}

function projectParallaxBridgeToMediaImportInput(
  bridge: ParallaxCreativeBridgeV1,
): CreateMediaImportReferenceInput {
  assertCreativeBridgeEnvelope(bridge);

  const native = bridge.payloadRefOrInline?.native;
  const image = native?.image;
  if (!image || !image.startsWith("data:image/")) {
    throw new Error("Creative handoff requires a native data:image payload");
  }

  const hash = bridge.contentHash?.startsWith("sha256:")
    ? { algorithm: "sha256" as const, value: bridge.contentHash.slice("sha256:".length) }
    : undefined;
  const width = native?.canvas?.width;
  const height = native?.canvas?.height;
  const metadata = width !== undefined || height !== undefined
    ? {
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
      }
    : undefined;

  return {
    source_uri: image,
    kind: "image",
    name: native?.name || `Auralith handoff ${bridge.transferId}`,
    ...(hash ? { hash } : {}),
    ...(metadata ? { metadata } : {}),
    rights_note: native?.note || "Creative image handed off by the user. Rights not independently verified by ParaCut.",
    imported_at: bridge.createdAt,
    copy_policy: "reference-only",
    intent: "image-overlay",
  };
}

function assertCreativeBridgeEnvelope(bridge: ParallaxCreativeBridgeV1): void {
  if (bridge.schema !== "parallax.bridge.v1" || bridge.protocol !== "parallax-bridge") {
    throw new Error("Expected parallax.bridge.v1 creative handoff");
  }
  if (bridge.source !== "Domistika" || bridge.target !== "Auralith369") {
    throw new Error("Unsupported creative bridge route");
  }
  if (!bridge.localOnly || bridge.requiresUserAction !== true) {
    throw new Error("Creative handoff must remain local and require explicit user action");
  }
}

function decodeBase64ImageDataUri(uri: string): Uint8Array {
  const comma = uri.indexOf(",");
  if (comma < 0) {
    throw new Error("Creative handoff data URI is malformed");
  }
  const header = uri.slice(0, comma);
  if (!header.startsWith("data:image/") || !header.endsWith(";base64")) {
    throw new Error("Verified creative handoff requires a base64 image data URI");
  }
  const encoded = uri.slice(comma + 1);
  let binary: string;
  try {
    binary = globalThis.atob(encoded);
  } catch {
    throw new Error("Creative handoff contains invalid base64 image bytes");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}


export interface ParallaxCreativeOverlayV2 {
  id: string;
  kind: "raster-overlay";
  role: "type" | "motion-ignore";
  name?: string;
  sourceLayerId?: string;
  preserveDuringStyle: boolean;
  opacity?: number;
  blendMode?: string;
  semantic?: unknown;
  image: string;
  contentHash: string;
}

export interface ParallaxCreativeNativeV2 {
  protocol: "parallax-creative-bridge";
  version: 2;
  source: "domistika";
  target: "auralith369";
  createdAt: string;
  name?: string;
  image: string;
  overlays: ParallaxCreativeOverlayV2[];
  canvas?: { width?: number; height?: number };
  palette?: string[];
  symmetry?: string;
  note?: string;
  baseContentHash: string;
  contentHash: string;
}

export interface ParallaxCreativeEvidenceV2 {
  auralithCaptureHash?: string;
  auralithCaptureSchema?: string;
  auralithReceiptHash?: string;
  auralithReceiptSchema?: string;
}

export interface ParallaxCreativeBridgeV2 {
  schema: "parallax.bridge.v2";
  protocol: "parallax-bridge";
  version: 2;
  transferId: string;
  source: "Domistika";
  target: "Auralith369";
  createdAt: string;
  localOnly: boolean;
  payloadType: "image/data-url+semantic-overlays";
  payloadRefOrInline: { native: ParallaxCreativeNativeV2 };
  contentHash: string;
  creativeEvidence?: ParallaxCreativeEvidenceV2;
  trustLabels?: string[];
  warnings?: string[];
  compatibilityNotes?: string[];
  lineageRef?: string | null;
  requiresUserAction: boolean;
}

export interface CreativeInteropV2Lineage {
  profile: "parallax.creative-interop.v2";
  sourceBridgeSchema: "parallax.bridge.v2";
  sourceTransferId: string;
  creativeManifestHash: string;
  baseContentHash: string;
  overlayContentHashes: string[];
  semanticOverlayCount: number;
  auralithCaptureHash?: string;
  auralithReceiptHash?: string;
}

export interface CreativeInteropV2ImportBundle {
  base: CreateMediaImportReferenceInput;
  overlays: CreateMediaImportReferenceInput[];
  lineage: CreativeInteropV2Lineage;
}

export async function verifyParallaxCreativeBridgeV2(
  bridge: ParallaxCreativeBridgeV2,
): Promise<void> {
  assertCreativeBridgeEnvelopeV2(bridge);
  const native = bridge.payloadRefOrInline.native;

  await assertDataUriHash(native.image, native.baseContentHash, "base artwork");

  for (const overlay of native.overlays) {
    if (overlay.kind !== "raster-overlay") {
      throw new Error("Creative Bridge v2 overlay kind must be raster-overlay");
    }
    if (overlay.role !== "type" && overlay.role !== "motion-ignore") {
      throw new Error("Creative Bridge v2 overlay role is unsupported");
    }
    if (!overlay.preserveDuringStyle) {
      throw new Error("Creative Bridge v2 protected overlay must preserveDuringStyle");
    }
    await assertDataUriHash(overlay.image, overlay.contentHash, "overlay " + overlay.id);
  }

  const manifestHash = await sha256Text(canonicalBridgeJson(creativeBridgeV2Manifest(native)));
  const expectedManifest = hashValue(native.contentHash, "native contentHash");
  if (manifestHash !== expectedManifest) {
    throw new Error("Creative Bridge v2 manifest contentHash does not match semantic manifest");
  }
  if (bridge.contentHash.toLowerCase() !== native.contentHash.toLowerCase()) {
    throw new Error("Parallax v2 envelope contentHash must equal native Creative Bridge v2 manifest hash");
  }

  for (const entry of Object.entries({
    auralithCaptureHash: bridge.creativeEvidence?.auralithCaptureHash,
    auralithReceiptHash: bridge.creativeEvidence?.auralithReceiptHash,
  })) {
    const label = entry[0];
    const hash = entry[1];
    if (hash !== undefined && !isSha256(hash)) {
      throw new Error(label + " must be sha256:<64 hex>");
    }
  }
}

export async function verifiedParallaxBridgeV2ToMediaImportBundle(
  bridge: ParallaxCreativeBridgeV2,
): Promise<CreativeInteropV2ImportBundle> {
  await verifyParallaxCreativeBridgeV2(bridge);
  const native = bridge.payloadRefOrInline.native;
  const metadata = native.canvas
    ? {
        ...(native.canvas.width !== undefined ? { width: native.canvas.width } : {}),
        ...(native.canvas.height !== undefined ? { height: native.canvas.height } : {}),
      }
    : undefined;

  const base: CreateMediaImportReferenceInput = {
    source_uri: native.image,
    kind: "image",
    name: native.name ? native.name + " · gradeable base" : "Creative base " + bridge.transferId,
    hash: { algorithm: "sha256", value: hashValue(native.baseContentHash, "baseContentHash") },
    ...(metadata && Object.keys(metadata).length ? { metadata } : {}),
    rights_note: native.note || "Creative base handed off by the user. Rights not independently verified by ParaCut.",
    imported_at: bridge.createdAt,
    copy_policy: "reference-only",
    intent: "image-overlay",
  };

  const overlays = native.overlays.map((overlay, index): CreateMediaImportReferenceInput => ({
    source_uri: overlay.image,
    kind: "image",
    name: overlay.name
      ? (native.name || "Creative artwork") + " · protected " + overlay.name
      : (native.name || "Creative artwork") + " · protected overlay " + (index + 1),
    hash: { algorithm: "sha256", value: hashValue(overlay.contentHash, "overlay " + overlay.id + " contentHash") },
    ...(metadata && Object.keys(metadata).length ? { metadata } : {}),
    rights_note: "Protected semantic overlay (" + overlay.role + ") from Creative Bridge v2. Rights not independently verified by ParaCut.",
    imported_at: bridge.createdAt,
    copy_policy: "reference-only",
    intent: "image-overlay",
  }));

  const lineage: CreativeInteropV2Lineage = {
    profile: "parallax.creative-interop.v2",
    sourceBridgeSchema: "parallax.bridge.v2",
    sourceTransferId: bridge.transferId,
    creativeManifestHash: bridge.contentHash.toLowerCase(),
    baseContentHash: native.baseContentHash.toLowerCase(),
    overlayContentHashes: native.overlays.map((overlay) => overlay.contentHash.toLowerCase()),
    semanticOverlayCount: native.overlays.length,
    ...(bridge.creativeEvidence?.auralithCaptureHash
      ? { auralithCaptureHash: bridge.creativeEvidence.auralithCaptureHash.toLowerCase() }
      : {}),
    ...(bridge.creativeEvidence?.auralithReceiptHash
      ? { auralithReceiptHash: bridge.creativeEvidence.auralithReceiptHash.toLowerCase() }
      : {}),
  };

  return { base, overlays, lineage };
}

function assertCreativeBridgeEnvelopeV2(bridge: ParallaxCreativeBridgeV2): void {
  if (bridge.schema !== "parallax.bridge.v2" || bridge.protocol !== "parallax-bridge" || bridge.version !== 2) {
    throw new Error("Expected parallax.bridge.v2 creative handoff");
  }
  if (bridge.source !== "Domistika" || bridge.target !== "Auralith369") {
    throw new Error("Unsupported Creative Bridge v2 route");
  }
  if (bridge.localOnly !== true || bridge.requiresUserAction !== true) {
    throw new Error("Creative Bridge v2 must remain local and require explicit user action");
  }
  if (bridge.payloadType !== "image/data-url+semantic-overlays") {
    throw new Error("Creative Bridge v2 payloadType is unsupported");
  }
  if (!isSha256(bridge.contentHash)) {
    throw new Error("Creative Bridge v2 envelope contentHash must be sha256:<64 hex>");
  }
  const native = bridge.payloadRefOrInline?.native;
  if (!native || native.version !== 2 || native.protocol !== "parallax-creative-bridge") {
    throw new Error("Native Creative Bridge v2 payload is required");
  }
  if (native.source !== "domistika" || native.target !== "auralith369") {
    throw new Error("Native Creative Bridge v2 route is unsupported");
  }
  if (!Array.isArray(native.overlays) || native.overlays.length > 16) {
    throw new Error("Creative Bridge v2 supports at most 16 protected overlays");
  }
  if (!isSha256(native.baseContentHash) || !isSha256(native.contentHash)) {
    throw new Error("Native Creative Bridge v2 requires SHA-256 base and manifest hashes");
  }
}

function creativeBridgeV2Manifest(native: ParallaxCreativeNativeV2): Record<string, unknown> {
  return {
    protocol: native.protocol,
    version: native.version,
    source: native.source,
    target: native.target,
    createdAt: native.createdAt,
    name: native.name || "",
    canvas: native.canvas || null,
    palette: Array.isArray(native.palette) ? native.palette : [],
    symmetry: native.symmetry || "none",
    note: native.note || "",
    baseContentHash: native.baseContentHash,
    overlays: native.overlays.map((overlay) => ({
      id: String(overlay.id || ""),
      kind: overlay.kind,
      role: overlay.role,
      name: String(overlay.name || ""),
      sourceLayerId: String(overlay.sourceLayerId || ""),
      preserveDuringStyle: Boolean(overlay.preserveDuringStyle),
      opacity: Number(overlay.opacity ?? 1),
      blendMode: String(overlay.blendMode || "normal"),
      semantic: overlay.semantic ?? null,
      contentHash: overlay.contentHash,
    })),
  };
}

async function assertDataUriHash(uri: string, claimedHash: string, label: string): Promise<void> {
  if (!isSha256(claimedHash)) {
    throw new Error(label + " contentHash must be sha256:<64 hex>");
  }
  const bytes = decodeBase64ImageDataUri(uri);
  const digestInput = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(digestInput).set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestInput);
  const actual = bytesToHex(new Uint8Array(digest));
  if (actual !== hashValue(claimedHash, label + " contentHash")) {
    throw new Error(label + " contentHash does not match image bytes");
  }
}

function isSha256(value: string): boolean {
  return /^sha256:[0-9a-fA-F]{64}$/.test(String(value));
}

function hashValue(value: string, label: string): string {
  if (!isSha256(value)) throw new Error(label + " must be sha256:<64 hex>");
  return value.slice("sha256:".length).toLowerCase();
}

async function sha256Text(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

function canonicalBridgeJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map((item) => canonicalBridgeJson(item)).join(",") + "]";
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return "{" + entries.map(([key, item]) => JSON.stringify(key) + ":" + canonicalBridgeJson(item)).join(",") + "}";
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("Unsupported canonical Creative Bridge v2 value");
  return encoded;
}
