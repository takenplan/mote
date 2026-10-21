/** Leveled browser logger. Bounded single-line fields; never logs bodies or tokens. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
const order: LogLevel[] = ['debug', 'info', 'warn', 'error'];
let minimum: LogLevel = 'debug';
export function setLogLevel(level: LogLevel) { if (order.includes(level)) minimum = level; }
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim() ? value.replaceAll(/[\r\n\t]+/g, ' ').slice(0, max) : undefined;
export interface LogFields {
  method?: string; route?: string; name?: string; kind?: string; state?: string; code?: string;
  status?: number; durationMs?: number; count?: number; bytes?: number; detail?: string;
}
function clean(fields: LogFields): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const key of ['method', 'route', 'name', 'kind', 'state', 'code', 'detail'] as const) { const value = text(fields[key], key === 'detail' ? 400 : 160); if (value) out[key] = value; }
  for (const key of ['status', 'durationMs', 'count', 'bytes'] as const) { const value = fields[key]; if (typeof value === 'number' && Number.isFinite(value)) out[key] = Math.round(value); }
  return out;
}
export function log(level: LogLevel, event: string, fields: LogFields = {}) {
  if (order.indexOf(level) < order.indexOf(minimum)) return;
  const record = { at: new Date().toISOString(), level, event, ...clean(fields) };
  if (level === 'error') console.error(record);
  else if (level === 'warn') console.warn(record);
  else if (level === 'info') console.info(record);
  else console.debug(record);
}
export const debug = (event: string, fields?: LogFields) => log('debug', event, fields);
export const info = (event: string, fields?: LogFields) => log('info', event, fields);
export const warn = (event: string, fields?: LogFields) => log('warn', event, fields);
export const error = (event: string, fields?: LogFields) => log('error', event, fields);
