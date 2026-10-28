import { afterEach, test as it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp, type QueryAgent } from '../../server/src/app';
import type { Config as ServerConfig } from '../../server/src/config';
import { defaultConfig } from '../src/config';
import { showCentral, type CentralNavigation } from '../src/central-navigation';
import { consumeLoginTicket } from '../../web/src/login-handoff';
import { connectionStorageKey, readStoredSession } from '../../web/src/session';

const origin = 'https://fixture.invalid';
const owner = 'generated-navigation-owner-token-123456789';
const inactive: QueryAgent = { configured: false, query: async () => { throw Error('No model calls belong in navigation contracts'); }, close: async () => {} };
const savedGlobals = new Map<string, PropertyDescriptor | undefined>();
function stubGlobal(key: string, value: unknown) {
  if (!savedGlobals.has(key)) savedGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
afterEach(() => {
  mock.restoreAll();
  for (const [key, value] of savedGlobals) {
    if (value) Object.defineProperty(globalThis, key, value);
    else Reflect.deleteProperty(globalThis, key);
  }
  savedGlobals.clear();
});

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'mote-navigation-'));
  const config: ServerConfig = {
    dataDir: directory, token: owner, tokenPath: join(directory, 'owner-token'), host: '127.0.0.1', port: 0, profile: 'test', tokenFromEnvironment: true,
    maxStorageBytes: 30 * 1024 * 1024, maxExportBytes: 4 * 1024 * 1024, retentionDays: 0, insightIntervalHours: 0,
    allowedOrigins: [origin], model: '', modelBaseUrl: 'https://api.deepseek.com', apiKey: '', allowUnauthenticatedLocal: false,
    embeddingModel: '', embeddingBaseUrl: '', embeddingApiKey: '', diagnosticsEnabled: false,
  };
  const value = await buildApp(config, { agent: inactive, backgroundWorker: false });
  const requests: { url: URL; init?: RequestInit }[] = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), origin);
    assert.equal(url.origin, origin);
    assert.equal(init?.redirect, 'error');
    requests.push({ url, init });
    const response = await value.app.inject({ method: (init?.method ?? 'GET') as 'GET' | 'POST', url: url.pathname + url.search, headers: Object.fromEntries(new Headers(init?.headers)), payload: init?.body as string | undefined });
    return new Response(response.body, { status: response.statusCode, headers: response.headers as Record<string, string> });
  };
  stubGlobal('fetch', fetcher);
  return { ...value, requests, close: async () => { await value.app.close(); await rm(directory, { recursive: true, force: true }); } };
}

function browser(url: string) {
  let href = url;
  const local = new Map<string, string>(), session = new Map<string, string>();
  const storage = (values: Map<string, string>) => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
  stubGlobal('location', { get href() { return href; }, get hash() { return new URL(href).hash; }, get pathname() { return new URL(href).pathname; }, get search() { return new URL(href).search; }, origin });
  stubGlobal('history', { replaceState: (_data: unknown, _unused: string, path: string) => { href = new URL(path, href).href; } });
  stubGlobal('localStorage', storage(local));
  stubGlobal('sessionStorage', storage(session));
  return { local, session, href: () => href };
}

function navigation(settings = { ...defaultConfig(), serverUrl: origin, token: owner }): CentralNavigation & { launchChrome: ReturnType<typeof mock.fn>; openDefault: ReturnType<typeof mock.fn> } {
  return { settings: () => settings, browserLogin: () => undefined, ensureBrowserLogin: async () => {}, platform: 'darwin', launchChrome: mock.fn(async () => undefined), openDefault: mock.fn(async () => undefined) };
}

it('carries the current desktop ticket into the real Web session consumer and rejects replay', async () => {
  const f = await fixture();
  try {
    const grant = await f.connections.session(origin, 'Generated desktop', { deviceId: 'generated-mac', deviceName: 'Generated Mac', platform: 'macos' }, 86400000);
    const current: import('../src/contracts').Config = { ...defaultConfig(), serverUrl: origin, token: owner };
    const entry = navigation(current);
    entry.ensureBrowserLogin = async () => { current.token = grant.token; current.authExpiresAt = grant.expiresAt; };
    await showCentral(entry, 'ask', 'capture:11111111-2222-4333-8444-555555555555');
    const url = entry.launchChrome.mock.calls[0].arguments[0] as string;
    const target = new URL(url), params = new URLSearchParams(target.hash.split('?')[1]);
    assert.equal(target.origin, origin); assert.equal(target.pathname, '/'); assert.equal(target.search, '');
    assert.ok(!url.includes(owner)); assert.ok(!url.includes(grant.token)); assert.match(params.get('loginTicket')!, /^[A-Za-z0-9_-]{43}$/);
    assert.equal(f.requests[0].url.pathname, '/api/login/ticket');
    assert.equal(new Headers(f.requests[0].init?.headers).get('authorization'), 'Bearer ' + grant.token);
    assert.deepEqual(JSON.parse(f.requests[0].init?.body as string), { expiresAt: grant.expiresAt });
    const b = browser(url);
    await consumeLoginTicket();
    assert.ok(!b.href().includes('loginTicket')); assert.ok(new URL(b.href()).hash.includes('evidence=capture%3A11111111-2222-4333-8444-555555555555'));
    assert.equal(readStoredSession(origin)?.token, grant.token); assert.equal(readStoredSession(origin)?.serverExpiresAt, grant.expiresAt);
    assert.equal(entry.openDefault.mock.calls.length, 0);
    browser(url);
    localStorage.setItem(connectionStorageKey, JSON.stringify({ token: 'generated-unrelated-old-session' }));
    await assert.rejects(consumeLoginTicket(), /Login link expired/);
    assert.equal(localStorage.getItem(connectionStorageKey), null); assert.equal(sessionStorage.getItem(connectionStorageKey), null);
  } finally { await f.close(); }
});

it('rejects expired tickets at the real exchange and discards a late exchange after a new login', async () => {
  let now = Date.now();
  mock.method(Date, 'now', () => now);
  const f = await fixture();
  try {
    const entry = navigation({ ...defaultConfig(), serverUrl: origin, token: owner, authExpiresAt: Date.now() + 60_000 });
    await showCentral(entry, 'notes');
    const expiredUrl = entry.launchChrome.mock.calls[0].arguments[0] as string;
    now += 61_000;
    browser(expiredUrl);
    await assert.rejects(consumeLoginTicket(), /Login link expired/);
    assert.equal(readStoredSession(origin), null);
    now -= 61_000;
    await showCentral(entry, 'notes');
    const url = entry.launchChrome.mock.calls[1].arguments[0] as string;
    const b = browser(url), fetcher = globalThis.fetch;
    let release!: () => void;
    const blocked = new Promise<void>(resolve => { release = resolve; });
    stubGlobal('fetch', async (...args: Parameters<typeof fetch>) => { const response = await fetcher(...args); await blocked; return response; });
    let active = true;
    const pending = consumeLoginTicket(() => active);
    active = false; localStorage.setItem(connectionStorageKey, JSON.stringify({ token: 'generated-newer-login' }));
    release();
    await assert.rejects(pending, /Login changed/);
    assert.equal(JSON.parse(b.local.get(connectionStorageKey)!).token, 'generated-newer-login');
  } finally { mock.restoreAll(); await f.close(); }
});

it('does not launch a browser after ticket or session preparation failure and repeats a later successful attempt', async () => {
  const f = await fixture();
  try {
    const current = { ...defaultConfig(), serverUrl: origin, token: 'generated-invalid-token'.repeat(3) }, entry = navigation(current);
    await assert.rejects(showCentral(entry, 'notes'));
    assert.equal(entry.launchChrome.mock.calls.length, 0); assert.equal(entry.openDefault.mock.calls.length, 0);
    current.token = owner;
    entry.ensureBrowserLogin = async () => { throw Error('Generated preparation failure'); };
    await assert.rejects(showCentral(entry, 'notes'), /Generated preparation failure/);
    assert.equal(entry.launchChrome.mock.calls.length, 0);
    entry.ensureBrowserLogin = async () => {};
    await showCentral(entry, 'notes');
    assert.equal(entry.launchChrome.mock.calls.length, 1);
  } finally { await f.close(); }
});

it('delegates signed-out navigation to the existing browser login before requesting a ticket', async () => {
  const entry = navigation({ ...defaultConfig(), serverUrl: origin, authSignedOut: true });
  const login = mock.fn(async () => undefined), fetcher = mock.fn();
  stubGlobal('fetch', fetcher);
  entry.browserLogin = () => login;
  await showCentral(entry, 'activity', undefined, 'generated/work');
  assert.deepEqual(login.mock.calls[0].arguments, ['activity', undefined, undefined, 'generated/work']);
  assert.equal(fetcher.mock.calls.length, 0); assert.equal(entry.launchChrome.mock.calls.length, 0);
});
