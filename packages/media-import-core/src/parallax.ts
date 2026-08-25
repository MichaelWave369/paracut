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

export function parallaxBridgeToMediaImportInput(
  bridge: ParallaxCreativeBridgeV1,
): CreateMediaImportReferenceInput {
  if (bridge.schema !== "parallax.bridge.v1" || bridge.protocol !== "parallax-bridge") {
    throw new Error("Expected parallax.bridge.v1 creative handoff");
  }
  if (bridge.source !== "Domistika" || bridge.target !== "Auralith369") {
    throw new Error("Unsupported creative bridge route");
  }
  if (!bridge.localOnly || bridge.requiresUserAction !== true) {
    throw new Error("Creative handoff must remain local and require explicit user action");
  }

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
