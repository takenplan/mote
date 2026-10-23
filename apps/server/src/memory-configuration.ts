import { z } from 'zod';

const policy = z.object({ maxWaitHours: z.number().min(1 / 60).max(8760).optional(), enabled: z.boolean(), intervalHours: z.number().min(1 / 60).max(8760), minChanges: z.number().int().min(1).max(100000), maxItems: z.number().int().min(1).max(2000) }).strict();
const settings = z.object({
  extraction: policy.extend({ enabled: z.literal(true) }), consolidation: policy.extend({ maxItems: z.number().int().min(1).max(50) }), insights: policy, working: policy,
  drainWindows: z.number().int().min(1).max(1000).default(100), batchCharacters: z.number().int().min(256).max(12000), recentTurns: z.number().int().min(2).max(20),
  contextCharacters: z.number().int().min(4000).max(60000), summaryCharacters: z.number().int().min(1000).max(12000),
}).strict().refine(value => value.summaryCharacters < value.contextCharacters, { message: 'Working summary must be smaller than the context budget', path: ['summaryCharacters'] });
export type LifecycleSettings = z.infer<typeof settings>;
/** Persisted window snapshots are complete; configuration preprocessing is separate. */
export const lifecycleSettingsSnapshotSchema = settings;
export const defaultLifecycleSettings: LifecycleSettings = {
  extraction: { enabled: true, intervalHours: 6, minChanges: 25, maxItems: 100 },
  consolidation: { enabled: true, intervalHours: 24, minChanges: 20, maxItems: 30 },
  insights: { enabled: true, intervalHours: 24, minChanges: 100, maxItems: 1000 },
  working: { enabled: true, intervalHours: 1, minChanges: 8, maxItems: 20 },
  drainWindows: 100, batchCharacters: 12000, recentTurns: 8, contextCharacters: 24000, summaryCharacters: 6000,
};
/** File edits can specify one budget or scheduling parameter; all defaults live here. */
export const lifecycleSettingsSchema = z.preprocess(raw => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const input = raw as Record<string, unknown>, result = { ...structuredClone(defaultLifecycleSettings), ...input } as Record<string, unknown>;
  for (const id of ['extraction', 'consolidation', 'insights', 'working'] as const) if (input[id] && typeof input[id] === 'object' && !Array.isArray(input[id])) result[id] = { ...defaultLifecycleSettings[id], ...input[id] as object };
  return result;
}, settings);
