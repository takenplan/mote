// Shared by the server, profile CLI and native supervisor; never reads ambient configuration.
export const MiB = 1024 * 1024;
export const MAX_LOG_FILE_BYTES = 100 * MiB;
export const MAX_TRACE_EVENT_BYTES = 8 * MiB;
export function defaultLogMaxBytes(profile) { return (profile === 'dev' ? 100 : 2) * MiB; }
export class LogRetentionError extends Error {
  constructor(field, message) { super(message); this.field = field; this.name = 'LogRetentionError'; }
}
export function logRetentionFromEnv(env, profile) {
  const number = (field, fallback, min, max, integer = false) => {
    const value = Number(env[field] ?? fallback);
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
      throw new LogRetentionError(field, `${field} must be ${integer ? 'an integer ' : ''}between ${min} and ${max}`);
    return value;
  };
  const inherited = env.MOTE_LOG_MAX_MB === undefined || env.MOTE_LOG_MAX_MB === 'auto';
  return {
    maxBytes: inherited ? defaultLogMaxBytes(profile) : Math.floor(number('MOTE_LOG_MAX_MB', 2, 0.1, profile === 'dev' ? 100 : 8) * MiB),
    maxFiles: number('MOTE_LOG_MAX_FILES', 3, 1, 10, true),
    maxEntries: number('MOTE_LOG_MAX_ENTRIES', 2000, 100, 5000, true),
    source: inherited ? 'profile-default' : 'explicit',
  };
}
