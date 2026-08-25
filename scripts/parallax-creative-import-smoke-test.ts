import { createMediaImportReference } from "../packages/media-import-core/src/index";
import { parallaxBridgeToMediaImportInput } from "../packages/media-import-core/src/parallax";

function expectTrue(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function expectEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const hashValue = "a".repeat(64);
const bridge = {
  schema: "parallax.bridge.v1" as const,
  protocol: "parallax-bridge" as const,
  version: 1 as const,
  transferId: "creative:interop-fixture",
  source: "Domistika" as const,
  target: "Auralith369" as const,
  createdAt: "2026-08-25T17:00:00Z",
  localOnly: true,
  payloadType: "image/data-url+creative-metadata",
  payloadRefOrInline: {
    native: {
      protocol: "parallax-creative-bridge",
      version: 1,
      source: "domistika",
      target: "auralith369",
      createdAt: "2026-08-25T17:00:00Z",
      name: "Interop Bloom",
      image: "data:image/webp;base64,QUJD",
      canvas: { width: 960, height: 720 },
      note: "Creator-controlled bridge fixture.",
    },
  },
  contentHash: `sha256:${hashValue}`,
  warnings: [],
  requiresUserAction: true,
};

const input = parallaxBridgeToMediaImportInput(bridge);
const reference = createMediaImportReference(input);

expectEqual(reference.kind, "image", "Bridge should enter ParaCut through native image import");
expectEqual(reference.intent, "image-overlay", "Creative image should keep native image-overlay intent");
expectEqual(reference.copy_policy, "reference-only", "Bridge should remain reference-only");
expectEqual(reference.media_input.hash?.algorithm, "sha256", "SHA-256 algorithm should be preserved");
expectEqual(reference.media_input.hash?.value, hashValue, "SHA-256 value should be preserved without prefix");
expectEqual(reference.media_input.metadata?.width, 960, "Canvas width should be preserved as media metadata");
expectEqual(reference.media_input.metadata?.height, 720, "Canvas height should be preserved as media metadata");
expectEqual(reference.media_input.imported_at, bridge.createdAt, "Bridge timestamp should become native imported_at");
expectTrue(reference.media_input.uri.startsWith("data:image/webp"), "Native data-image URI should be preserved");

let blocked = false;
try {
  parallaxBridgeToMediaImportInput({ ...bridge, requiresUserAction: false });
} catch {
  blocked = true;
}
expectTrue(blocked, "Adapter must reject a handoff that removes explicit user action");

console.log("ParaCut Parallax creative import smoke test passed", {
  assetId: reference.asset_id,
  hash: reference.media_input.hash,
  intent: reference.intent,
});
