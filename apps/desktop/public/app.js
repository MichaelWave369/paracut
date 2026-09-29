import { installParaCutInteropRoom } from './interop-room.js';

const api = installParaCutInteropRoom(window, { storage: window.localStorage });

const $ = selector => document.querySelector(selector);
const status = $('#status');
const sourceEl = $('#source-state');
const mediaEl = $('#media-state');
const timelineEl = $('#timeline-state');
const lineageEl = $('#lineage-state');
const outputEl = $('#output-state');

const shortHash = value => value ? value.slice(0, 18) + '…' : '—';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function render() {
  const state = api.state();
  sourceEl.innerHTML = state.lineage
    ? '<strong>Creative Bridge v2 verified</strong>' +
      '<span>Manifest ' + shortHash(state.lineage.creativeManifestHash) + '</span>' +
      '<span>Base ' + shortHash(state.lineage.baseContentHash) + '</span>' +
      '<span>' + state.lineage.semanticOverlayCount + ' protected overlay(s)</span>'
    : '<span>No verified creative bridge imported yet.</span>';

  mediaEl.innerHTML = state.assets.length
    ? state.assets.map(asset =>
      '<div class="asset">' +
      '<strong>' + escapeHtml(asset.name) + '</strong>' +
      '<span>' + escapeHtml(asset.metadata?.semantic?.role || 'paint') + '</span>' +
      '<code>' + shortHash('sha256:' + asset.hash.value) + '</code>' +
      '</div>').join('')
    : '<span>No ParaCut media references yet.</span>';

  timelineEl.innerHTML = state.timeline
    ? state.timeline.tracks.map((track, index) =>
      '<div class="track">' +
      '<span>' + escapeHtml(track.name) + '</span>' +
      '<div class="clip ' + (index ? 'overlay' : '') + '">' + escapeHtml(track.clips[0].clip_id) + '</div>' +
      '</div>').join('')
    : '<span>No timeline yet.</span>';

  lineageEl.innerHTML = state.lineage
    ? '<dl>' +
      '<dt>Creative manifest</dt><dd><code>' + escapeHtml(state.lineage.creativeManifestHash) + '</code></dd>' +
      '<dt>Auralith capture</dt><dd><code>' + escapeHtml(state.lineage.auralithCaptureHash || 'not observed') + '</code></dd>' +
      '<dt>Auralith receipt</dt><dd><code>' + escapeHtml(state.lineage.auralithReceiptHash || 'not observed') + '</code></dd>' +
      '<dt>Overlay hashes</dt><dd>' + state.lineage.overlayContentHashes.map(hash => '<code>' + escapeHtml(hash) + '</code>').join('<br>') + '</dd>' +
      '</dl>'
    : '<span>Lineage appears after verified import.</span>';

  outputEl.innerHTML = state.plan
    ? '<strong>RenderPlan ready</strong>' +
      '<span>' + escapeHtml(state.plan.plan_id) + '</span>' +
      '<code>' + escapeHtml(state.planHash || '') + '</code>' +
      '<span>Revision ' + (state.planRevision || 'not transferred') + '</span>' +
      '<span>' + (state.waveForgeReady ? 'WaveForge handoff written ✓' : 'WaveForge handoff not written') + '</span>'
    : '<span>No RenderPlan yet.</span>';
}

async function run(label, task) {
  status.textContent = label + '…';
  status.dataset.kind = 'working';
  try {
    const result = await task();
    status.textContent = label + ' ✓';
    status.dataset.kind = 'ok';
    render();
    return result;
  } catch (error) {
    status.textContent = String(error?.message || error);
    status.dataset.kind = 'error';
    throw error;
  }
}

$('#receive').addEventListener('click', () => run('Verified source bridge', async () => {
  const envelope = await api.bridge.receive();
  return {
    schema: envelope.schema,
    transferId: envelope.transferId,
    contentHash: envelope.contentHash,
  };
}));

$('#import').addEventListener('click', () => run('Imported creative lineage', () => api.bridge.import()));
$('#timeline').addEventListener('click', () => run('Created deterministic timeline', () => api.timeline.create({ durationSeconds: 12 })));
$('#plan').addEventListener('click', () => run('Created RenderPlan', () => api.render.plan({ outputUri: './exports/acceptance-003.mp4' })));
$('#waveforge').addEventListener('click', () => run('Wrote WaveForge v2 handoff', () => api.bridge.waveforge.transfer({ planRevision: 1 })));

async function installSiteTools() {
  const modelContext = document.modelContext || navigator.modelContext;
  if (!modelContext?.registerTool) return;

  const defs = [
    {
      name: 'paracut_get_interop_state',
      title: 'Get ParaCut Interop Room state',
      description: 'Read the current verified creative lineage, ParaCut media references, timeline, RenderPlan, receipt, and WaveForge readiness.',
      readOnly: true,
      execute: async () => JSON.stringify({ ok: true, state: api.state() }),
    },
    {
      name: 'paracut_receive_creative_bridge',
      title: 'Verify creative bridge',
      description: 'Read and independently verify the current same-origin Creative Bridge v2 package without importing it.',
      execute: async () => {
        const envelope = await api.bridge.receive();
        return JSON.stringify({ ok: true, transfer: {
          schema: envelope.schema,
          transferId: envelope.transferId,
          contentHash: envelope.contentHash,
          evidence: envelope.creativeEvidence || null,
          overlayCount: envelope.payloadRefOrInline.native.overlays.length,
        } });
      },
    },
    {
      name: 'paracut_import_creative_bridge',
      title: 'Import creative bridge',
      description: 'Verify and import the gradeable base plus protected overlays as separate ParaCut reference-only assets.',
      execute: async () => JSON.stringify({ ok: true, state: await api.bridge.import() }),
    },
    {
      name: 'paracut_create_acceptance_timeline',
      title: 'Create ParaCut acceptance timeline',
      description: 'Create a deterministic bounded timeline from the currently imported Creative Interop assets.',
      execute: async ({ durationSeconds = 12 } = {}) => JSON.stringify({
        ok: true,
        timeline: await api.timeline.create({ durationSeconds }),
      }),
      schema: {
        type: 'object',
        properties: { durationSeconds: { type: 'number', minimum: 1, maximum: 3600, default: 12 } },
        additionalProperties: false,
      },
    },
    {
      name: 'paracut_plan_render',
      title: 'Plan ParaCut render',
      description: 'Create and hash a native deterministic RenderPlan. This does not render media.',
      execute: async ({ outputUri = './exports/acceptance-003.mp4' } = {}) => JSON.stringify({
        ok: true,
        result: await api.render.plan({ outputUri }),
      }),
      schema: {
        type: 'object',
        properties: { outputUri: { type: 'string', maxLength: 300 } },
        additionalProperties: false,
      },
    },
    {
      name: 'paracut_transfer_waveforge',
      title: 'Transfer RenderPlan to WaveForge',
      description: 'Write a local-only Creative Interop v2 WaveForge handoff with RenderPlan hash, creative lineage, and explicit false authority flags.',
      execute: async ({ planRevision = 1 } = {}) => {
        const transfer = await api.bridge.waveforge.transfer({ planRevision });
        return JSON.stringify({ ok: true, transfer: {
          schema: transfer.schema,
          transferId: transfer.transferId,
          contentHash: transfer.contentHash,
          planRevision: transfer.planRevision,
          creativeLineage: transfer.creativeLineage,
          authority: transfer.authority,
        } });
      },
      schema: {
        type: 'object',
        properties: { planRevision: { type: 'integer', minimum: 1, maximum: 1000000, default: 1 } },
        additionalProperties: false,
      },
    },
  ];

  const controller = new AbortController();
  for (const def of defs) {
    await modelContext.registerTool({
      name: def.name,
      title: def.title,
      description: def.description,
      inputSchema: def.schema || { type: 'object', properties: {}, additionalProperties: false },
      annotations: {
        readOnlyHint: Boolean(def.readOnly),
        untrustedContentHint: true,
        consequentialHint: false,
      },
      execute: def.execute,
    }, { signal: controller.signal });
  }

  window.paracutInteropSiteTools = Object.freeze({
    version: '0.1.0',
    registered: defs.map(item => item.name),
    stop: () => controller.abort(),
  });
}

render();
installSiteTools().catch(error => console.warn('[ParaCut] site-tool install failed', error));
