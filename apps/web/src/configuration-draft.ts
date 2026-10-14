import type {ConfigurationField, ServerConfiguration} from '@mote/shared';
export type DraftValues = Record<string, string>;

/** Controls edit saved values, including settings awaiting a restart. */
export function savedValues(config: ServerConfiguration): DraftValues {
  return Object.fromEntries(config.groups.flatMap(group => group.fields)
    .filter(field => field.domain && field.path && field.visibility !== 'secret-status')
    .map(field => {
      const value = field.savedValue === undefined ? field.value : field.savedValue;
      return [field.key, field.unit === 'bytes' && typeof value === 'number' ? String(value / 1048576)
        : Array.isArray(value) ? value.join(',') : typeof value === 'boolean' ? value ? '1' : '0' : String(value ?? '')];
    }));
}

function fieldValue(field: ConfigurationField, value: string): unknown {
  const previous = field.savedValue === undefined ? field.value : field.savedValue;
  if (typeof previous === 'boolean') return value === '1';
  if (Array.isArray(previous)) return value.split(',').map(item => item.trim()).filter(Boolean);
  if (typeof previous === 'number') {
    const number = Number(value);
    if (!value.trim() || !Number.isFinite(number)) throw new Error('Invalid numeric configuration value');
    return field.unit === 'bytes' ? number * 1048576 : field.key === 'connectorSyncInterval' ? number * 1000 : number;
  }
  return value;
}

/** Submit only edited, registered fields; never echo redacted credentials back to the file. */
export function configurationPatches(config: ServerConfiguration, changes: DraftValues): {id: string; value: Record<string, unknown>}[] {
  const fields = new Map(config.groups.flatMap(group => group.fields).map(field => [field.key, field]));
  const domains = new Map<string, Record<string, unknown>>();
  for (const [key, value] of Object.entries(changes)) {
    const field = fields.get(key);
    if (!field?.domain || !field.path || field.visibility === 'secret-status') throw new Error('Field is not editable');
    const path = field.path.split('.');
    if (path.some(part => !part || ['__proto__', 'constructor', 'prototype', '*'].includes(part))) throw new Error('Field is not editable');
    const patch = domains.get(field.domain) ?? {};
    domains.set(field.domain, patch);
    let target = patch;
    for (const part of path.slice(0, -1)) target = (target[part] ??= {}) as Record<string, unknown>;
    target[path.at(-1)!] = fieldValue(field, value);
  }
  return [...domains].map(([id, value]) => ({id, value}));
}
