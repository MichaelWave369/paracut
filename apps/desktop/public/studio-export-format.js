// Browser recording format selection and container verification.
// No transcoding, network requests, or misleading file extensions.
export const MIME_CANDIDATES = Object.freeze({
  mp4: [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1.424028,mp4a.40.2',
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4'
  ],
  webm: [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ]
});

export function findRecorderMime(format, mediaRecorder = globalThis.MediaRecorder) {
  if (!Object.hasOwn(MIME_CANDIDATES, format) || !mediaRecorder ||
      typeof mediaRecorder.isTypeSupported !== 'function') return null;
  for (const mime of MIME_CANDIDATES[format]) {
    try { if (mediaRecorder.isTypeSupported(mime)) return mime; }
    catch { /* unsupported candidate */ }
  }
  return null;
}

export function expectedMime(format) {
  if (format === 'mp4') return 'video/mp4';
  if (format === 'webm') return 'video/webm';
  throw Error('Unknown export format.');
}

export function recorderOutputFormat(requestedFormat, recorderMime) {
  // A UA can choose different codecs but must not silently change container.
  const actual = String(recorderMime || '').toLowerCase().split(';',1)[0].trim();
  if (actual !== expectedMime(requestedFormat)) throw Error(
    'Browser returned ' + (actual || 'unknown format') + ' instead of ' +
    requestedFormat.toUpperCase() + '. Nothing was downloaded.');
  return actual;
}

export async function sniffContainer(blob) {
  // This is a signature check, not a complete playable-media validator.
  if (!blob || blob.size < 8 || typeof blob.slice !== 'function') return null;
  const data = new Uint8Array(await blob.slice(0,64).arrayBuffer());
  if (data.length >= 4 && data[0] === 0x1a && data[1] === 0x45 &&
      data[2] === 0xdf && data[3] === 0xa3) return 'webm';
  // ISO BMFF initial ftyp box: length (4 bytes) followed by ASCII 'ftyp'.
  // Browsers may choose any compatible brand, so don't insist on 'isom'.
  if (data.length >= 12 && data[4] === 0x66 && data[5] === 0x74 &&
      data[6] === 0x79 && data[7] === 0x70) {
    const length = (data[0]*0x1000000 + (data[1]<<16) + (data[2]<<8) + data[3]) >>> 0;
    if (length >= 12 && length <= blob.size) return 'mp4';
  }
  return null;
}

export async function checkExportContainer(blob, expectedFormat) {
  expectedMime(expectedFormat);
  const detected = await sniffContainer(blob);
  if (detected !== expectedFormat) throw Error(
    'Export container check failed: expected ' + expectedFormat.toUpperCase() +
    ', detected ' + (detected?.toUpperCase() || 'unknown') +
    '. No file was downloaded.');
  return true;
}
