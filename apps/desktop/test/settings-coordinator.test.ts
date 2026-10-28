import { afterEach, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigStore, defaultConfig } from '../src/config';
import { Collector } from '../src/collector';
import { DurableQueue } from '../src/queue';
import { QueueStorage } from '../src/queue-storage';
import { LocalSourceManager } from '../src/source-manager';
import { DEFAULT_SOURCE_OPTIONS } from '../src/source-types';
import { NoteDraftStore } from '../src/note-draft';
import { SettingsCoordinator, type SettingsDependencies } from '../src/settings-coordinator';
import type { Config } from '../src/contracts';
import { event, image } from './fixtures';

// Only the unavailable Electron system boundary is replaced; transactions, drafts,
// source checkpoints, queue bindings and the collector's settings lifecycle are real.
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  return { powerMonitor: new EventEmitter(), systemPreferences: { getMediaAccessStatus: () => 'granted' }, desktopCapturer: {}, nativeImage: {}, screen: {} };
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function fixture(unbound = false) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'mote-settings-')));
  const profile = join(root, 'profile'); await mkdir(profile);
  const store = new ConfigStore(profile, { available: () => true, encrypt: value => Buffer.from(value), decrypt: value => value.toString() });
  await store.save({ ...defaultConfig(), serverUrl: unbound ? '' : 'https://fixture.invalid', token: unbound ? undefined : 'generated-settings-owner-token-123456789', syncMode: 'manual' });
  let settings = await store.load(), recovery: string | undefined, loginItem = settings.openAtLogin;
  const storage = new QueueStorage(profile, 'test', settings.deviceId);
  const queue = new DurableQueue(await storage.open(''), settings); await queue.initialize();
  const notes = new NoteDraftStore(join(profile, 'notes')); await notes.initialize();
  const sources = new LocalSourceManager(join(profile, 'sources'), settings, '/unused', true); await sources.initialize();
  const collector = new Collector(settings, queue, '/unused', () => true, () => {}, undefined, undefined, sources);
  const dependencies: SettingsDependencies = {
    settings: () => settings, installSettings: value => { settings = value; }, store, collector, sources, queue, notes,
    defaultProfile: true, loginItems: { get: () => loginItem, set: value => { loginItem = value; } },
    running: () => collector.status().running, quitting: () => false, recoveryRequired: () => recovery,
    requireRecovery: message => { recovery = message; collector.requireRecovery(message); void sources.close(); },
    configureDiagnostics: vi.fn(async () => {}), clearStorageSelection: vi.fn(), connectionStatus: vi.fn(),
    relocate: updated => queue.relocate(updated.captureStorageDirectory || storage.defaultDirectory, storage, () => store.save(updated), async () => (await store.load()).captureStorageDirectory || storage.defaultDirectory),
  };
  const coordinator = new SettingsCoordinator(dependencies);
  const addPending = async () => {
    const file = join(root, 'generated.md'); await writeFile(file, 'Generated immutable settings regression evidence.');
    await sources.addFiles(file, DEFAULT_SOURCE_OPTIONS); await sources.sync();
    const capture = { ...event(), deviceId: settings.deviceId }; await queue.enqueue(capture, image); await queue.failed(capture.id, Date.now(), () => 0.5);
    const draft = { ...notes.get(), text: 'Generated prepared note', mood: '', revision: 1 };
    await expect(notes.submit(draft, settings, 'macos', { enqueue: async () => { throw Error('Generated interrupted note enqueue'); } })).rejects.toThrow('interrupted');
    return { capture, draft };
  };
  return { root, profile, store, storage, queue, notes, sources, collector, dependencies, coordinator, addPending, settings: () => settings, recovery: () => recovery, loginItem: () => loginItem,
    close: async () => { collector.shutdown(); await sources.close(); await rm(root, { recursive: true, force: true }); } };
}

it('rolls back a failed pre-commit save, retains queue/draft data and allows a later settings retry', async () => {
  const f = await fixture();
  try {
    await f.addPending();
    const previous = f.settings(), archive = await f.queue.exportArchive(), pending = structuredClone(f.sources.pendingContent());
    const updated = { ...previous, openAtLogin: !previous.openAtLogin, syncIntervalMinutes: previous.syncIntervalMinutes + 1 };
    vi.spyOn(f.store, 'save').mockRejectedValueOnce(Error('Generated disk failure before commit'));
    await expect(f.coordinator.paused(() => f.coordinator.apply(updated))).rejects.toThrow('before commit');
    expect(f.settings()).toBe(previous); expect(await f.store.load()).toEqual(previous); expect(f.loginItem()).toBe(previous.openAtLogin); expect(f.recovery()).toBeUndefined();
    expect(f.collector.status().config.syncIntervalMinutes).toBe(previous.syncIntervalMinutes);
    expect(await f.queue.exportArchive()).toEqual(archive); expect(f.sources.pendingContent()).toEqual(pending); expect(f.notes.hasPrepared()).toBe(true);
    await f.coordinator.paused(() => f.coordinator.apply(updated));
    expect(f.settings()).toBe(updated); expect(await f.store.load()).toEqual(updated); expect(f.dependencies.clearStorageSelection).toHaveBeenCalledTimes(1);
  } finally { await f.close(); }
});

it('preserves both real queue copies and enters recovery when config rename committed before reporting failure', async () => {
  const f = await fixture();
  try {
    await f.addPending();
    const external = join(f.root, 'external'); await mkdir(external);
    const source = f.queue.directory, target = await f.storage.candidate(external, source), archive = await f.queue.exportArchive();
    const updated = { ...f.settings(), captureStorageDirectory: target };
    const save = f.store.save.bind(f.store);
    vi.spyOn(f.store, 'save').mockImplementationOnce(async config => { await save(config); throw Error('Generated failure after durable config rename'); });
    await expect(f.coordinator.paused(() => f.coordinator.apply(updated))).rejects.toThrow('恢复');
    expect((await f.store.load()).captureStorageDirectory).toBe(target); expect(f.recovery()).toContain('恢复');
    expect((await stat(source)).isDirectory()).toBe(true); expect((await stat(target)).isDirectory()).toBe(true);
    expect(await f.queue.exportArchive()).toEqual(archive); expect(f.notes.hasPrepared()).toBe(true);
    expect(f.collector.status().state).toBe('error'); expect(f.dependencies.clearStorageSelection).not.toHaveBeenCalled();
  } finally { await f.close(); }
});

it('keeps exact pending source bodies, capture identity and prepared note through same-node reauthorization', async () => {
  const f = await fixture();
  try {
    const { capture, draft } = await f.addPending(), previous = f.settings(), pending = structuredClone(f.sources.pendingContent());
    const updated = { ...previous, token: 'generated-settings-replacement-token-123456789' };
    await f.coordinator.connectionChange(() => f.coordinator.commitConnection(updated, true, true), true, true);
    expect(f.queue.binding.matches(updated)).toBe(true); expect(f.sources.nodeBinding.matches(updated)).toBe(true);
    expect(f.sources.pendingContent()).toEqual(pending); expect(f.queue.recordForHistory(capture.id)?.event).toEqual(capture);
    expect(f.queue.recordForHistory(capture.id)?.nextAttemptAt).toBe(0); expect(f.notes.get()).toMatchObject({ ...draft, prepared: true });
    await expect(f.coordinator.connectionChange(() => f.coordinator.commitConnection({ ...updated, serverUrl: 'https://other.invalid' }))).rejects.toThrow('不能更换');
    expect(f.settings()).toBe(updated); expect(await f.store.load()).toEqual(updated);
    // A newly created note window/store sees the same durable prepared draft, then finishes it once.
    const reopened = new NoteDraftStore(join(f.profile, 'notes')); await reopened.initialize();
    const result = await reopened.submit(draft, updated, 'macos', f.queue);
    expect(result.id).toBe(draft.id); expect(f.queue.stats().depth).toBe(2);
    expect(await reopened.submit(draft, updated, 'macos', f.queue)).toEqual(result); expect(f.queue.stats().depth).toBe(2);
  } finally { await f.close(); }
});

it('binds an explicitly confirmed unbound backlog including an interrupted prepared note before saving credentials', async () => {
  const f = await fixture(true);
  try {
    const { draft } = await f.addPending();
    expect(f.coordinator.unboundBacklog()).toBe(true); expect(f.notes.hasUnboundPrepared()).toBe(true);
    const updated: Config = { ...f.settings(), serverUrl: 'https://fixture.invalid', token: 'generated-initial-settings-token-123456789' };
    const save = f.store.save.bind(f.store);
    vi.spyOn(f.store, 'save').mockImplementationOnce(async config => {
      expect(f.queue.binding.matches(updated)).toBe(true); expect(f.sources.nodeBinding.matches(updated)).toBe(true); expect(f.notes.hasUnboundPrepared()).toBe(false);
      await save(config);
    });
    await f.coordinator.connectionChange(() => f.coordinator.commitConnection(updated, false, true), false, true);
    const reopened = new NoteDraftStore(join(f.profile, 'notes')); await reopened.initialize();
    expect(reopened.get()).toMatchObject({ ...draft, prepared: true });
    await expect(reopened.submit(draft, { ...updated, serverUrl: 'https://other.invalid' }, 'macos', f.queue)).rejects.toThrow('原中央节点');
    expect((await reopened.submit(draft, updated, 'macos', f.queue)).id).toBe(draft.id);
  } finally { await f.close(); }
});

it('releases the real collector hold after source acquisition failure so a repeated operation can finish', async () => {
  const f = await fixture();
  try {
    const operation = vi.fn(async () => 'completed');
    vi.spyOn(f.sources, 'holdConnection').mockRejectedValueOnce(Error('Generated source hold failure'));
    await expect(f.coordinator.paused(operation)).rejects.toThrow('source hold failure'); expect(operation).not.toHaveBeenCalled();
    expect(await f.coordinator.paused(operation)).toBe('completed'); expect(operation).toHaveBeenCalledTimes(1);
    expect(f.collector.status().running).toBe(false); expect(f.recovery()).toBeUndefined();
  } finally { await f.close(); }
});
