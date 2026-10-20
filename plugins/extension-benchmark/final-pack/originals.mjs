import {createHash} from 'node:crypto';

export const sha256 = value => createHash('sha256').update(value).digest('hex');

// readOriginal has bounded pages even when length is omitted. Preserve bytes
// across chunk boundaries before decoding UTF-8 and calling the semantic seam.
export async function originalText(originalRef, host, signal) {
  if (typeof originalRef !== 'string' || !originalRef.startsWith('original:')) {
    throw Error('original_reference_required');
  }
  const chunks = [];
  let offset = 0, descriptor;
  do {
    signal.throwIfAborted();
    const part = await host.call('readOriginal', [originalRef, {offset}]);
    if (part.ref !== originalRef || !Number.isSafeInteger(part.totalBytes) || part.totalBytes < offset) {
      throw Error('invalid_original_response');
    }
    if (descriptor && (descriptor.sourceId !== part.sourceId || descriptor.totalBytes !== part.totalBytes)) {
      throw Error('original_changed_during_read');
    }
    descriptor = part;
    const bytes = Buffer.from(part.bytes?.data ?? part.bytes ?? []);
    if (offset + bytes.length > part.totalBytes || (!bytes.length && offset < part.totalBytes)) {
      throw Error('invalid_original_chunk');
    }
    chunks.push(bytes);
    offset += bytes.length;
  } while (offset < descriptor.totalBytes);
  signal.throwIfAborted();
  const bytes = Buffer.concat(chunks);
  return {originalRef, sourceId: descriptor.sourceId, text: bytes.toString('utf8'), sha256: sha256(bytes)};
}
