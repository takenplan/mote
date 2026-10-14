export const MiB: number;
export const MAX_LOG_FILE_BYTES: number;
export const MAX_TRACE_EVENT_BYTES: number;
export function defaultLogMaxBytes(profile?: string): number;
export class LogRetentionError extends Error { field: string; constructor(field: string, message: string); }
export function logRetentionFromEnv(env: Record<string, string | undefined>, profile?: string): {
  maxBytes: number; maxFiles: number; maxEntries: number; source: 'profile-default' | 'explicit';
};
