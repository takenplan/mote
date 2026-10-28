import { afterEach, expect, it, vi } from 'vitest';
import { AskController } from '../src/ask-controller';
import { defaultConfig } from '../src/config';
import type { Config } from '../src/contracts';

afterEach(() => vi.unstubAllGlobals());
function fixture() {
  let settings: Config = { ...defaultConfig(), serverUrl: 'https://fixture.invalid', token: 'generated-ask-owner-token-123456789' };
  const installLogin = vi.fn(async () => {}), endLogin = vi.fn(async () => {}), browserLogin = vi.fn(async () => {});
  const controller = new AskController({ settings: () => settings, installLogin, endLogin, browserLogin });
  return { controller, installLogin, endLogin, browserLogin, settings: () => settings, replace: (next: Config) => { settings = next; } };
}

it('preserves current login command validation and hands browser duration to the existing login transaction', async () => {
  const f = fixture(), fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  for (const token of [undefined, 42, 'short', 'x'.repeat(8193), 'generated-valid'.repeat(3) + '\n']) await expect(f.controller.request('login', { token })).rejects.toThrow('有效');
  expect(f.installLogin).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  const token = 'generated-owner-login-token'.repeat(2);
  expect(await f.controller.request('login', { token: '  ' + token + '  ', durationMs: 86400000 })).toEqual({});
  expect(f.installLogin).toHaveBeenCalledWith(token, 86400000);
  expect(await f.controller.request('login-browser', { durationMs: 0 })).toEqual({});
  expect(f.browserLogin).toHaveBeenCalledWith(undefined, undefined, 0);
  expect(await f.controller.request('logout')).toEqual({}); expect(f.endLogin).toHaveBeenCalledTimes(1);
});

it('does not let a late rejected Ask response sign out a newer login', async () => {
  const f = fixture(); let release!: (response: Response) => void;
  const fetcher = vi.fn(async () => new Promise<Response>(resolve => { release = resolve; })); vi.stubGlobal('fetch', fetcher);
  const pending = f.controller.request('runs');
  expect(fetcher).toHaveBeenCalledTimes(1);
  f.replace({ ...f.settings(), token: 'generated-new-ask-owner-token-123456789' });
  release(Response.json({ error: 'unauthorized' }, { status: 401 }));
  await expect(pending).rejects.toThrow('会话已变更'); expect(f.endLogin).not.toHaveBeenCalled();
  expect(f.settings().token).toBe('generated-new-ask-owner-token-123456789');
});

it('uses actual Ask endpoints, signs out a current revoked credential and permits a later retry', async () => {
  const f = fixture();
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ error: 'unauthorized' }, { status: 401 })).mockResolvedValueOnce(Response.json({}, { status: 500 })).mockResolvedValueOnce(Response.json({ items: [{ id: 'generated-running-query', status: 'running' }] }));
  vi.stubGlobal('fetch', fetcher);
  await expect(f.controller.request('runs')).rejects.toThrow('令牌无效'); expect(f.endLogin).toHaveBeenCalledTimes(1);
  await expect(f.controller.request('runs')).rejects.toThrow('HTTP 500'); expect(f.endLogin).toHaveBeenCalledTimes(1);
  expect(await f.controller.request('runs')).toEqual({ items: [{ id: 'generated-running-query', status: 'running' }] });
  for (const [url, options] of fetcher.mock.calls) {
    expect(url).toBe('https://fixture.invalid/api/query-runs'); expect(options.redirect).toBe('error');
    expect(options.headers.Authorization).toBe('Bearer ' + f.settings().token);
  }
});
