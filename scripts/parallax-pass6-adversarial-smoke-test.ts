import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  type ParallaxCreativeBridgeV1,
  verifyParallaxCreativeBridgeContentHash,
  verifiedParallaxBridgeToMediaImportInput,
} from "../packages/media-import-core/src/parallax";

const artifact = JSON.parse(
  await readFile(new URL("./fixtures/parallax-pass5-artifact.json", import.meta.url), "utf8"),
);

function goodBridge(): ParallaxCreativeBridgeV1 {
  return {
    schema: "parallax.bridge.v1",
    protocol: "parallax-bridge",
    version: 1,
    transferId: `creative:pass6:${artifact.name}`,
    source: "Domistika",
    target: "Auralith369",
    createdAt: "2026-08-25T22:20:00Z",
    localOnly: true,
    payloadType: "image/data-url+creative-metadata",
    payloadRefOrInline: {
      native: {
        protocol: "parallax-creative-bridge",
        version: 1,
        source: "domistika",
        target: "auralith369",
        createdAt: "2026-08-25T22:20:00Z",
        name: artifact.name,
        image: artifact.data_uri,
        canvas: { width: artifact.width, height: artifact.height },
        note: artifact.rights_note,
      },
    },
    contentHash: `sha256:${artifact.sha256}`,
    warnings: [],
    requiresUserAction: true,
  };
}

async function expectReject(
  label: string,
  action: () => Promise<unknown>,
  pattern: RegExp,
): Promise<void> {
  let rejected = false;
  try {
    await action();
  } catch (error) {
    rejected = true;
    assert.match(String(error), pattern, `${label} should fail for the expected reason`);
  }
  assert.equal(rejected, true, `${label} must fail closed`);
}

await verifyParallaxCreativeBridgeContentHash(goodBridge());
const verifiedInput = await verifiedParallaxBridgeToMediaImportInput(goodBridge());
assert.equal(verifiedInput.hash?.value, artifact.sha256);

const byteTampered = goodBridge();
const uri = byteTampered.payloadRefOrInline.native?.image;
if (!uri) throw new Error("fixture image missing");
const [header, encoded] = uri.split(",", 2);
if (!header || !encoded) throw new Error("fixture data URI malformed");
const tamperedBytes = Buffer.from(encoded, "base64");
tamperedBytes[0] = (tamperedBytes[0] ?? 0) ^ 0x01;
byteTampered.payloadRefOrInline.native!.image = `${header},${tamperedBytes.toString("base64")}`;
await expectReject(
  "one-byte artifact mutation",
  () => verifiedParallaxBridgeToMediaImportInput(byteTampered),
  /contentHash does not match native image bytes/,
);

const substitutedHash = goodBridge();
substitutedHash.contentHash = `sha256:${"0".repeat(64)}`;
await expectReject(
  "content hash substitution",
  () => verifiedParallaxBridgeToMediaImportInput(substitutedHash),
  /contentHash does not match native image bytes/,
);

const missingHash = goodBridge();
missingHash.contentHash = null;
await expectReject(
  "missing content hash",
  () => verifiedParallaxBridgeToMediaImportInput(missingHash),
  /requires contentHash/,
);

const nonLocal = goodBridge();
nonLocal.localOnly = false;
await expectReject(
  "local-only boundary removal",
  () => verifiedParallaxBridgeToMediaImportInput(nonLocal),
  /remain local and require explicit user action/,
);

const noUserAction = goodBridge();
noUserAction.requiresUserAction = false;
await expectReject(
  "human-action boundary removal",
  () => verifiedParallaxBridgeToMediaImportInput(noUserAction),
  /remain local and require explicit user action/,
);

console.log("ParaCut Pass 6 adversarial creative-ingress smoke passed", {
  artifactSha256: artifact.sha256,
  rejectedMutations: 5,
});
