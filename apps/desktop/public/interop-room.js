const SOURCE_KEY = 'parallax-creative-bridge-v2';
const EVIDENCE_KEY = 'parallax-creative-evidence-v2';
const STATE_KEY = 'paracut-interop-room-v1';
const WAVEFORGE_KEY = 'parallax-paracut-waveforge-v2';

const isSha256 = value => /^sha256:[0-9a-fA-F]{64}$/.test(String(value || ''));

export function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return '{' + entries.map(([key, item]) => JSON.stringify(key) + ':' + stableJson(item)).join(',') + '}';
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error('PARACUT_INTEROP_UNSUPPORTED_CANONICAL_VALUE');
  return encoded;
}

const bytesToHex = bytes => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');

async function sha256Bytes(bytes) {
  const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const copy = new ArrayBuffer(source.byteLength);
  new Uint8Array(copy).set(source);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', copy);
  return 'sha256:' + bytesToHex(new Uint8Array(digest));
}

export async function sha256Text(value) {
  return sha256Bytes(new TextEncoder().encode(String(value)));
}

function decodeDataUri(uri) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i.exec(String(uri || ''));
  if (!match) throw new Error('PARACUT_INTEROP_IMAGE_DATA_URI_REQUIRED');
  let binary;
  try {
    binary = globalThis.atob(match[2]);
  } catch {
    throw new Error('PARACUT_INTEROP_IMAGE_DATA_URI_INVALID');
  }
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function verifyDataUriHash(uri, claimed, label) {
  if (!isSha256(claimed)) throw new Error(label + ' must be sha256:<64 hex>');
  const actual = await sha256Bytes(decodeDataUri(uri));
  if (actual.toLowerCase() !== String(claimed).toLowerCase()) {
    throw new Error(label + ' does not match image bytes');
  }
}

export function creativeManifest(native) {
  return {
    protocol: native.protocol,
    version: native.version,
    source: native.source,
    target: native.target,
    createdAt: native.createdAt,
    name: native.name || '',
    canvas: native.canvas || null,
    palette: Array.isArray(native.palette) ? native.palette : [],
    symmetry: native.symmetry || 'none',
    note: native.note || '',
    baseContentHash: native.baseContentHash,
    overlays: (native.overlays || []).map(overlay => ({
      id: String(overlay.id || ''),
      kind: overlay.kind,
      role: overlay.role,
      name: String(overlay.name || ''),
      sourceLayerId: String(overlay.sourceLayerId || ''),
      preserveDuringStyle: Boolean(overlay.preserveDuringStyle),
      opacity: Number(overlay.opacity ?? 1),
      blendMode: String(overlay.blendMode || 'normal'),
      semantic: overlay.semantic ?? null,
      contentHash: overlay.contentHash,
    })),
  };
}

export async function verifyCreativeBridgeV2(native) {
  if (!native || native.protocol !== 'parallax-creative-bridge' || native.version !== 2) {
    throw new Error('PARACUT_INTEROP_CREATIVE_BRIDGE_V2_REQUIRED');
  }
  if (native.source !== 'domistika' || native.target !== 'auralith369') {
    throw new Error('PARACUT_INTEROP_CREATIVE_ROUTE_INVALID');
  }
  if (!Array.isArray(native.overlays) || native.overlays.length > 16) {
    throw new Error('PARACUT_INTEROP_OVERLAY_COUNT_INVALID');
  }
  await verifyDataUriHash(native.image, native.baseContentHash, 'baseContentHash');
  for (const overlay of native.overlays) {
    if (overlay.kind !== 'raster-overlay') throw new Error('PARACUT_INTEROP_OVERLAY_KIND_INVALID');
    if (!['type', 'motion-ignore'].includes(overlay.role)) throw new Error('PARACUT_INTEROP_OVERLAY_ROLE_INVALID');
    if (overlay.preserveDuringStyle !== true) throw new Error('PARACUT_INTEROP_OVERLAY_MUST_BE_PROTECTED');
    await verifyDataUriHash(overlay.image, overlay.contentHash, 'overlay ' + overlay.id + ' contentHash');
  }
  if (!isSha256(native.contentHash)) throw new Error('PARACUT_INTEROP_MANIFEST_HASH_REQUIRED');
  const actualManifest = await sha256Text(stableJson(creativeManifest(native)));
  if (actualManifest.toLowerCase() !== native.contentHash.toLowerCase()) {
    throw new Error('PARACUT_INTEROP_MANIFEST_HASH_MISMATCH');
  }
  return true;
}

function storageGet(storage, key) {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storageSet(storage, key, value) {
  if (!storage?.setItem) return false;
  storage.setItem(key, JSON.stringify(value));
  return true;
}

function normalizeEvidence(native, evidence) {
  if (!evidence) return null;
  if (evidence.schema !== 'parallax.creative-evidence.v2') {
    throw new Error('PARACUT_INTEROP_EVIDENCE_SCHEMA_INVALID');
  }
  if (String(evidence.creativeManifestHash || '').toLowerCase() !== native.contentHash.toLowerCase()) {
    throw new Error('PARACUT_INTEROP_EVIDENCE_MANIFEST_MISMATCH');
  }
  if (evidence.baseContentHash && String(evidence.baseContentHash).toLowerCase() !== native.baseContentHash.toLowerCase()) {
    throw new Error('PARACUT_INTEROP_EVIDENCE_BASE_MISMATCH');
  }
  for (const key of ['auralithCaptureHash', 'auralithReceiptHash']) {
    if (evidence[key] != null && !isSha256(evidence[key])) throw new Error('PARACUT_INTEROP_EVIDENCE_HASH_INVALID');
  }
  return {
    creativeManifestHash: native.contentHash.toLowerCase(),
    ...(evidence.auralithCaptureHash ? { auralithCaptureHash: evidence.auralithCaptureHash.toLowerCase() } : {}),
    ...(evidence.auralithCaptureSchema ? { auralithCaptureSchema: String(evidence.auralithCaptureSchema) } : {}),
    ...(evidence.auralithReceiptHash ? { auralithReceiptHash: evidence.auralithReceiptHash.toLowerCase() } : {}),
    ...(evidence.auralithReceiptSchema ? { auralithReceiptSchema: String(evidence.auralithReceiptSchema) } : {}),
  };
}

export async function wrapCreativeBridgeV2(native, evidence = null) {
  await verifyCreativeBridgeV2(native);
  const normalizedEvidence = normalizeEvidence(native, evidence);
  return {
    schema: 'parallax.bridge.v2',
    protocol: 'parallax-bridge',
    version: 2,
    transferId: 'creative-v2:' + native.createdAt + ':' + (native.name || 'untitled'),
    source: 'Domistika',
    target: 'Auralith369',
    createdAt: native.createdAt,
    localOnly: true,
    payloadType: 'image/data-url+semantic-overlays',
    payloadRefOrInline: { native },
    contentHash: native.contentHash.toLowerCase(),
    ...(normalizedEvidence ? { creativeEvidence: normalizedEvidence } : {}),
    trustLabels: ['semantic-overlay-bound'],
    warnings: [],
    compatibilityNotes: ['Wrapped live by ParaCut Interop Room after independent Creative Bridge v2 verification.'],
    lineageRef: null,
    requiresUserAction: true,
  };
}

async function makeReceipt(event, state, extra = {}) {
  const payload = {
    schema: 'paracut.interop-room.receipt.v1',
    event,
    createdAt: new Date().toISOString(),
    projectId: state?.project?.project_id || null,
    creativeManifestHash: state?.lineage?.creativeManifestHash || null,
    planHash: state?.planHash || null,
    ...extra,
    authority: {
      observationOnly: true,
      renderAuthorized: false,
      publishAuthorized: false,
      automaticImportAuthorized: false,
    },
  };
  const receiptHash = await sha256Text(stableJson(payload));
  return { ...payload, receiptId: receiptHash, receiptHash };
}

function makeAsset(native, image, hash, name, index, semantic = null) {
  return {
    asset_id: index === 0 ? 'creative-base' : 'creative-overlay-' + index,
    kind: 'image',
    name,
    uri: image,
    hash: { algorithm: 'sha256', value: hash.slice('sha256:'.length) },
    metadata: {
      width: native.canvas?.width ?? null,
      height: native.canvas?.height ?? null,
      semantic,
    },
    rights_note: 'User-controlled Creative Interop v2 reference. Rights not independently verified by ParaCut.',
    imported_at: native.createdAt,
    copy_policy: 'reference-only',
  };
}

export function createMemoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  return {
    getItem: key => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: key => { map.delete(key); },
    dump: () => Object.fromEntries(map.entries()),
  };
}

export function createParaCutInteropRoom({ storage = globalThis.localStorage } = {}) {
  let state = storageGet(storage, STATE_KEY) || {
    schema: 'paracut.interop-room.state.v1',
    roomVersion: '0.1.0',
    source: null,
    project: null,
    assets: [],
    lineage: null,
    timeline: null,
    plan: null,
    planHash: null,
    planRevision: null,
    latestReceipt: null,
    waveForgeTransfer: null,
  };

  const persist = () => {
    const portable = {
      ...state,
      source: state.source ? { ...state.source, payloadRefOrInline: { native: '[held in creative bridge storage]' } } : null,
      assets: state.assets.map(asset => ({ ...asset, uri: '[held in creative bridge storage]' })),
    };
    storageSet(storage, STATE_KEY, portable);
  };

  const receive = async () => {
    const native = storageGet(storage, SOURCE_KEY);
    if (!native) throw new Error('PARACUT_INTEROP_NO_CREATIVE_BRIDGE_V2');
    const evidence = storageGet(storage, EVIDENCE_KEY);
    const envelope = await wrapCreativeBridgeV2(native, evidence);
    return envelope;
  };

  const importBridge = async () => {
    const envelope = await receive();
    const native = envelope.payloadRefOrInline.native;
    const base = makeAsset(native, native.image, native.baseContentHash, (native.name || 'Creative artwork') + ' · gradeable base', 0, { role: 'paint' });
    const overlays = native.overlays.map((overlay, index) => makeAsset(
      native,
      overlay.image,
      overlay.contentHash,
      (native.name || 'Creative artwork') + ' · protected ' + (overlay.name || ('overlay ' + (index + 1))),
      index + 1,
      {
        role: overlay.role,
        preserveDuringStyle: true,
        sourceLayerId: overlay.sourceLayerId || null,
        semantic: overlay.semantic || null,
      },
    ));
    const lineage = {
      profile: 'parallax.creative-interop.v2',
      sourceBridgeSchema: 'parallax.bridge.v2',
      sourceTransferId: envelope.transferId,
      creativeManifestHash: envelope.contentHash,
      baseContentHash: native.baseContentHash.toLowerCase(),
      overlayContentHashes: native.overlays.map(item => item.contentHash.toLowerCase()),
      semanticOverlayCount: native.overlays.length,
      ...(envelope.creativeEvidence?.auralithCaptureHash ? { auralithCaptureHash: envelope.creativeEvidence.auralithCaptureHash } : {}),
      ...(envelope.creativeEvidence?.auralithReceiptHash ? { auralithReceiptHash: envelope.creativeEvidence.auralithReceiptHash } : {}),
    };
    const projectId = 'interop-' + envelope.contentHash.slice(7, 19);
    state = {
      ...state,
      source: envelope,
      project: {
        project_id: projectId,
        name: native.name || 'Creative Interop Project',
        schema_version: 'paracut.project.v0',
      },
      assets: [base, ...overlays],
      lineage,
      timeline: null,
      plan: null,
      planHash: null,
      planRevision: null,
      waveForgeTransfer: null,
    };
    state.latestReceipt = await makeReceipt('creative-import', state, { assetCount: state.assets.length });
    persist();
    return snapshot();
  };

  const createTimeline = async ({ durationSeconds = 12 } = {}) => {
    if (!state.project || !state.assets.length) throw new Error('PARACUT_INTEROP_IMPORT_REQUIRED');
    const duration = Math.max(1, Math.min(3600, Number(durationSeconds) || 12));
    state.timeline = {
      duration_seconds: duration,
      tracks: state.assets.map((asset, index) => ({
        track_id: index === 0 ? 'video-base' : 'video-overlay-' + index,
        kind: 'video',
        name: asset.name,
        clips: [{
          clip_id: index === 0 ? 'clip-base' : 'clip-overlay-' + index,
          asset_id: asset.asset_id,
          timeline: { start: 0, end: duration },
          source: { start: 0, end: duration },
          enabled: true,
          semantic: asset.metadata?.semantic || null,
        }],
      })),
    };
    state.latestReceipt = await makeReceipt('timeline-create', state, { durationSeconds: duration, trackCount: state.timeline.tracks.length });
    persist();
    return state.timeline;
  };

  const planRender = async ({ outputUri = './exports/acceptance-003.mp4' } = {}) => {
    if (!state.timeline || !state.project) throw new Error('PARACUT_INTEROP_TIMELINE_REQUIRED');
    const duration = state.timeline.duration_seconds;
    const inputs = state.assets.map((asset, index) => ({
      input_id: 'input_' + index,
      input_index: index,
      asset_id: asset.asset_id,
      uri: asset.uri,
      kind: 'image',
      name: asset.name,
    }));
    const clips = state.timeline.tracks.flatMap((track, trackIndex) => track.clips.map(clip => ({
      clip_id: clip.clip_id,
      asset_id: clip.asset_id,
      input_id: 'input_' + state.assets.findIndex(asset => asset.asset_id === clip.asset_id),
      input_index: state.assets.findIndex(asset => asset.asset_id === clip.asset_id),
      track_id: track.track_id,
      track_kind: 'video',
      timeline_start: clip.timeline.start,
      timeline_end: clip.timeline.end,
      source_start: clip.source.start,
      source_end: clip.source.end,
      enabled: true,
    })));
    state.plan = {
      plan_id: 'plan-' + state.lineage.creativeManifestHash.slice(7, 19),
      job_id: 'job-' + state.lineage.creativeManifestHash.slice(7, 19),
      project_id: state.project.project_id,
      output_uri: String(outputUri || './exports/acceptance-003.mp4'),
      preset: {
        preset_id: 'preset_wide_1080p',
        name: 'Wide 1080p',
        platform: 'wide',
        width: 1920,
        height: 1080,
        fps: 30,
        video_codec: 'h264',
        audio_codec: 'aac',
        container: 'mp4',
      },
      duration_seconds: duration,
      inputs,
      clips,
      filter_graph: [],
      argv: [],
      warnings: ['Interop Room creates a deterministic RenderPlan only. It does not render media.'],
      created_at: new Date().toISOString(),
    };
    state.planHash = await sha256Text(stableJson(state.plan));
    state.latestReceipt = await makeReceipt('render-plan', state, { planHash: state.planHash });
    persist();
    return { plan: state.plan, contentHash: state.planHash };
  };

  const transferWaveForge = async ({ planRevision = 1 } = {}) => {
    if (!state.plan || !state.planHash || !state.lineage) throw new Error('PARACUT_INTEROP_RENDER_PLAN_REQUIRED');
    const revision = Number(planRevision);
    if (!Number.isInteger(revision) || revision < 1) throw new Error('PARACUT_INTEROP_PLAN_REVISION_INVALID');
    const lineage = {
      ...state.lineage,
      paraCutAssetHashes: state.assets.map(asset => 'sha256:' + asset.hash.value),
    };
    const transfer = {
      schema: 'parallax.bridge.v2',
      protocol: 'parallax-bridge',
      version: 2,
      interopProfile: 'parallax.creative-interop.v2',
      transferId: 'paracut-waveforge-v2:' + state.plan.plan_id,
      source: 'ParaCut',
      target: 'WaveForgeStudio',
      createdAt: new Date().toISOString(),
      localOnly: true,
      payloadType: 'application/vnd.paracut.render-plan+json',
      payloadRefOrInline: { native: state.plan },
      contentHash: state.planHash,
      planRevision: revision,
      creativeLineage: lineage,
      trustLabels: ['creative-lineage-bound'],
      warnings: [],
      compatibilityNotes: [
        'Reference-only handoff. WaveForgeStudio must not treat this bridge as render authorization.',
        'Creative lineage is provenance evidence only and grants no execution, publishing, rights, or release authority.',
      ],
      lineageRef: lineage.creativeManifestHash,
      requiresUserAction: true,
      authority: {
        realRenderingAuthorized: false,
        networkAuthorized: false,
        subprocessAuthorized: false,
        automaticImportAuthorized: false,
        publishAuthorized: false,
      },
    };
    storageSet(storage, WAVEFORGE_KEY, transfer);
    state.planRevision = revision;
    state.waveForgeTransfer = transfer;
    state.latestReceipt = await makeReceipt('waveforge-transfer', state, {
      planRevision: revision,
      bridgeHash: await sha256Text(stableJson(transfer)),
    });
    persist();
    return transfer;
  };

  const snapshot = () => ({
    schema: state.schema,
    roomVersion: state.roomVersion,
    project: state.project,
    assets: state.assets.map(asset => ({
      asset_id: asset.asset_id,
      kind: asset.kind,
      name: asset.name,
      hash: asset.hash,
      metadata: asset.metadata,
      copy_policy: asset.copy_policy,
    })),
    lineage: state.lineage,
    timeline: state.timeline,
    plan: state.plan,
    planHash: state.planHash,
    planRevision: state.planRevision,
    latestReceipt: state.latestReceipt,
    waveForgeReady: Boolean(state.waveForgeTransfer),
  });

  return Object.freeze({
    schema: 'paracut.interop-room.v1',
    version: '0.1.0',
    capabilities: () => ({
      creativeBridge: { version: 2, storageKey: SOURCE_KEY },
      creativeEvidence: { schema: 'parallax.creative-evidence.v2', storageKey: EVIDENCE_KEY },
      waveForge: { version: 2, storageKey: WAVEFORGE_KEY },
      renderAuthority: false,
      networkAuthority: false,
      publishAuthority: false,
    }),
    bridge: Object.freeze({
      receive,
      import: importBridge,
      waveforge: Object.freeze({ transfer: transferWaveForge }),
    }),
    project: Object.freeze({ current: () => snapshot().project }),
    timeline: Object.freeze({ create: createTimeline, current: () => snapshot().timeline }),
    render: Object.freeze({ plan: planRender, current: () => snapshot().plan }),
    receipts: Object.freeze({ latest: () => state.latestReceipt }),
    state: snapshot,
  });
}

export function installParaCutInteropRoom(target = globalThis.window, options = {}) {
  const api = createParaCutInteropRoom(options);
  if (target) target.ParaCut = api;
  return api;
}

export const PARACUT_INTEROP_STORAGE_KEYS = Object.freeze({
  source: SOURCE_KEY,
  evidence: EVIDENCE_KEY,
  state: STATE_KEY,
  waveForge: WAVEFORGE_KEY,
});
