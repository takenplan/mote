import { readFileSync, openSync, fstatSync, closeSync, constants } from 'node:fs';
import { dirname, resolve } from 'node:path';
import YAML from 'yaml';

export type ConfigDocument = Record<string, unknown>;
export const MAX_CONFIG_FILE_BYTES = 1024 * 1024;

/** Secret references are resolved only in declared credential fields. Ordinary settings remain literal. */
export function isConfigSecretPath(path: readonly (string | number)[]): boolean {
  const key = path.join('.');
  return ['server.token', 'storage.dataKey', 'models.deployment.apiKey', 'models.embedding.apiKey',
    'connectors.mcpReadToken', 'connectors.mcpWriteToken', 'connectors.googleClientId', 'connectors.googleClientSecret', 'media.workerToken', 'processing.settings.apiKey', 'processing.settings.localWorkerApiKey'].includes(key)
    || /^processing\.policy\.services\.\d+\.apiKey$/.test(key)
    || /^models\.profiles\.\d+\.settings\.apiKey$/.test(key)
    || /^models\.(deployment|profiles\.\d+\.settings)\.(headers|extraBody)(\.|$)/.test(key);
}
function mapSecrets(value: unknown, env: NodeJS.ProcessEnv, path: (string | number)[] = []): unknown {
  if (typeof value === 'string' && isConfigSecretPath(path)) return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, name: string) => {
    if (env[name] === undefined) throw new Error('Missing secret environment variable in a declared credential field');
    return env[name]!;
  });
  if (Array.isArray(value)) return value.map((entry, index) => mapSecrets(entry, env, [...path, index]));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, mapSecrets(entry, env, [...path, key])]));
  return value;
}
export function parseConfigDocument(raw: string, env: NodeJS.ProcessEnv = process.env) {
  if (Buffer.byteLength(raw) > MAX_CONFIG_FILE_BYTES) throw new Error('Configuration exceeds 1 MiB');
  const yaml = YAML.parseDocument(raw, { uniqueKeys: true, merge: false });
  if (yaml.errors.length) throw new Error('Configuration YAML is invalid; contents are suppressed');
  let savedDocument: unknown;
  try { savedDocument = yaml.toJS({ maxAliasCount: 0 }); }
  catch { throw new Error('Configuration YAML aliases are not supported'); }
  if (!savedDocument || typeof savedDocument !== 'object' || Array.isArray(savedDocument)) throw new Error('Configuration must be a YAML mapping');
  if ((savedDocument as ConfigDocument).version !== 1) throw new Error('Unsupported configuration version; create a version 1 mote.yaml before starting');
  const revision = (savedDocument as ConfigDocument).revision;
  if (!Number.isSafeInteger(revision) || Number(revision) < 0) throw new Error('Configuration revision must be a nonnegative safe integer');
  return { savedDocument: savedDocument as ConfigDocument, document: mapSecrets(savedDocument, env) as ConfigDocument };
}
export function readConfigDocument(file: string, env: NodeJS.ProcessEnv = process.env) {
  const configFile = resolve(file), fd = openSync(configFile, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.size > MAX_CONFIG_FILE_BYTES || info.nlink !== 1) throw new Error('Configuration must be a regular YAML file without symbolic or hard links, at most 1 MiB');
    return { ...parseConfigDocument(readFileSync(fd, 'utf8'), env), configFile, baseDir: dirname(configFile) };
  } finally { closeSync(fd); }
}
export function serializeConfigDocument(document: ConfigDocument): string {
  return YAML.stringify(document, { lineWidth: 0, aliasDuplicateObjects: false });
}
/** Model advanced fields can carry credentials, so offline output hides their complete values. */
export function redactConfigDocument(document: ConfigDocument): ConfigDocument {
  function redact(value: unknown, path: (string | number)[]): unknown {
    const key = path.join('.');
    if (key === 'plugins.configuration' || isConfigSecretPath(path) || /^models\.(deployment|profiles\.\d+\.settings)\.(headers|extraBody)$/.test(key)) return value ? '[redacted]' : value;
    if (typeof value === 'string' && /(?:baseUrl|Endpoint|publicUrl|googleRedirectUri)$/.test(String(path.at(-1)))) {
      try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return '[invalid endpoint hidden]'; } catch { if (value) return '[invalid endpoint hidden]'; }
    }
    if (Array.isArray(value)) return value.map((entry, index) => redact(entry, [...path, index]));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, redact(entry, [...path, name])]));
    return value;
  }
  return redact(document, []) as ConfigDocument;
}
export function configSecretEnvironment(document: ConfigDocument, env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const names = new Set<string>();
  function visit(value: unknown, path: (string | number)[]) {
    const pluginReference = path[0] === 'plugins' && path[1] === 'configuration';
    if (typeof value === 'string' && (isConfigSecretPath(path) || pluginReference)) {
      for (const match of value.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)) {
        const name = match[1]!;
        if (['MOTE_CONFIG_FILE', 'NODE_OPTIONS', 'NODE_PATH', 'NODE_ENV', 'NODE_EXTRA_CA_CERTS', 'PATH', 'HOME', 'ENV', 'BASH_ENV', 'PYTHONPATH', 'PYTHONHOME'].includes(name) || /^(?:DOCKER_|COMPOSE_|LD_|DYLD_)/.test(name)) throw new Error('Secret references cannot target process bootstrap variables');
        names.add(name);
      }
    } else if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, [...path, index]));
    else if (value && typeof value === 'object') for (const [name, entry] of Object.entries(value)) visit(entry, [...path, name]);
  }
  visit(document, []);
  return Object.fromEntries([...names].filter(name => env[name] !== undefined).map(name => [name, env[name]!]));
}
