import { readFileSync } from 'node:fs';

/** Ambient endpoint settings never turn a functional fixture into a live call. */
export async function testEmbeddingConfiguration(env = process.env) {
  if (env.MOTE_TEST_LIVE_EMBEDDINGS !== '1') return undefined;
  if (!env.MOTE_MEM0_TEST_EMBEDDING_CONFIG) throw new Error('Live embeddings require MOTE_MEM0_TEST_EMBEDDING_CONFIG');
  try {
    const value = JSON.parse(readFileSync(env.MOTE_MEM0_TEST_EMBEDDING_CONFIG, 'utf8'));
    const { mem0RuntimeConfigSchema } = await import('../../dist/mem0-memory-runtime.js');
    return mem0RuntimeConfigSchema.shape.embedding.parse({ baseUrl: value.baseUrl, apiKey: value.apiKey,
      model: value.model, dimension: value.dimension });
  } catch {
    // JSON/schema errors must not echo a private configuration's contents.
    throw new Error('Live embedding configuration is unavailable or invalid');
  }
}
