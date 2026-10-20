import {createHash} from 'node:crypto';

// This apply-only package deliberately retains its native-style ABI. The test
// establishes the loading boundary; it never claims a Harness tool executed.
export function apply(ctx) {
  ctx.tool('benchmark_checksum', async ({text}) => ({
    sha256: createHash('sha256').update(text).digest('hex'),
  }));
}
