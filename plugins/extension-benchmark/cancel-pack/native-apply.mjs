import {createHash} from 'node:crypto';

// Unchanged apply-only native specimen. It is not rewritten into the Mote ABI.
export function apply(ctx) {
  ctx.tool('generated_checksum', {
    description: 'Checksum generated text without external effects',
    execute: ({text}) => createHash('sha256').update(text).digest('hex'),
  });
}
