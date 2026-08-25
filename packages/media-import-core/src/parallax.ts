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
