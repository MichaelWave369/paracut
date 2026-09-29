import assert from 'node:assert/strict';
import {
  createMemoryStorage,
  createParaCutInteropRoom,
  creativeManifest,
  sha256Text,
  stableJson,
} from '../apps/desktop/public/interop-room.js';

const dataUri = value => 'data:image/png;base64,' + Buffer.from(value).toString('base64');
const shaData = async uri => {
  const bytes = Buffer.from(uri.split(',', 2)[1], 'base64');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + Buffer.from(digest).toString('hex');
};

const image = dataUri('acceptance-003-base');
const title = dataUri('acceptance-003-title');

const native = {
  protocol: 'parallax-creative-bridge',
  version: 2,
  source: 'domistika',
  target: 'auralith369',
  createdAt: '2026-09-29T03:15:00Z',
  name: 'Acceptance-003 Dune Jewel',
  image,
  canvas: { width: 1600, height: 1200 },
  palette: ['#8a5d34', '#d2a25b'],
  symmetry: 'none',
  note: 'Acceptance 003 live-room fixture',
  baseContentHash: await shaData(image),
  overlays: [{
    id: 'overlay-1',
    kind: 'raster-overlay',
    role: 'type',
    name: 'Title',
    sourceLayerId: 'layer-title',
    preserveDuringStyle: true,
    opacity: 1,
    blendMode: 'normal',
    semantic: [{ kind: 'text', text: 'Acceptance-003 Dune Jewel' }],
    image: title,
    contentHash: await shaData(title),
  }],
};
native.contentHash = await sha256Text(stableJson(creativeManifest(native)));

const evidence = {
  schema: 'parallax.creative-evidence.v2',
  profile: 'parallax.creative-interop.v2',
  createdAt: '2026-09-29T03:16:00Z',
  event: 'capture',
  projectName: native.name,
  creativeManifestHash: native.contentHash,
  baseContentHash: native.baseContentHash,
  protectedOverlayHashes: [native.overlays[0].contentHash],
  auralithCaptureHash: 'sha256:' + '4'.repeat(64),
  auralithCaptureSchema: 'auralith.capture.png.v1',
  auralithReceiptHash: 'sha256:' + '5'.repeat(64),
  auralithReceiptSchema: 'auralith.observation-receipt.v1',
};

const storage = createMemoryStorage({
  'parallax-creative-bridge-v2': native,
  'parallax-creative-evidence-v2': evidence,
});

const room = createParaCutInteropRoom({ storage });

const envelope = await room.bridge.receive();
assert.equal(envelope.schema, 'parallax.bridge.v2');
assert.equal(envelope.contentHash, native.contentHash);
assert.equal(envelope.creativeEvidence.auralithCaptureHash, evidence.auralithCaptureHash);

const imported = await room.bridge.import();
assert.equal(imported.assets.length, 2);
assert.equal(imported.assets[0].metadata.semantic.role, 'paint');
assert.equal(imported.assets[1].metadata.semantic.role, 'type');
assert.equal(imported.lineage.semanticOverlayCount, 1);
assert.equal(imported.lineage.auralithReceiptHash, evidence.auralithReceiptHash);

const timeline = await room.timeline.create({ durationSeconds: 12 });
assert.equal(timeline.tracks.length, 2);
assert.equal(timeline.duration_seconds, 12);

const planned = await room.render.plan({ outputUri: './exports/acceptance-003.mp4' });
assert.equal(planned.plan.project_id, imported.project.project_id);
assert.match(planned.contentHash, /^sha256:[0-9a-f]{64}$/);
assert.equal(planned.plan.warnings.length, 1);

const transfer = await room.bridge.waveforge.transfer({ planRevision: 1 });
assert.equal(transfer.schema, 'parallax.bridge.v2');
assert.equal(transfer.interopProfile, 'parallax.creative-interop.v2');
assert.equal(transfer.contentHash, planned.contentHash);
assert.equal(transfer.planRevision, 1);
assert.equal(transfer.creativeLineage.creativeManifestHash, native.contentHash);
assert.equal(transfer.creativeLineage.paraCutAssetHashes.length, 2);
assert.equal(transfer.authority.realRenderingAuthorized, false);
assert.equal(transfer.authority.networkAuthorized, false);
assert.equal(transfer.requiresUserAction, true);

const stored = JSON.parse(storage.getItem('parallax-paracut-waveforge-v2'));
assert.equal(stored.transferId, transfer.transferId);

const receipt = room.receipts.latest();
assert.equal(receipt.schema, 'paracut.interop-room.receipt.v1');
assert.equal(receipt.event, 'waveforge-transfer');
assert.match(receipt.receiptHash, /^sha256:[0-9a-f]{64}$/);

const tampered = structuredClone(native);
tampered.overlays[0].semantic[0].text = 'Changed after manifest';
const badStorage = createMemoryStorage({ 'parallax-creative-bridge-v2': tampered });
const badRoom = createParaCutInteropRoom({ storage: badStorage });
await assert.rejects(
  badRoom.bridge.receive(),
  /MANIFEST_HASH_MISMATCH/,
);

console.log('ParaCut Interop Room v0.1 live-chain smoke passed', {
  creativeManifestHash: native.contentHash,
  planHash: planned.contentHash,
  receiptHash: receipt.receiptHash,
});
