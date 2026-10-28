import { expect, it, vi } from 'vitest';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultConfig } from '../src/config';
import { LocalSourceManager } from '../src/source-manager';
import { DEFAULT_SOURCE_OPTIONS } from '../src/source-types';
import { SourceSelectionController } from '../src/source-selection';

it('retries only the unfinished native selection members after partial registration failure', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'mote-selection-')));
  const manager = new LocalSourceManager(join(root, 'sources'), { ...defaultConfig(), syncMode: 'manual' }, '/unused', true);
  try {
    await manager.initialize();
    const paths = [join(root, 'generated-first.md'), join(root, 'generated-second.md')];
    for (const path of paths) await writeFile(path, 'Generated selected source evidence.');
    const add = manager.addFiles.bind(manager); let fail = true;
    const addFiles = vi.spyOn(manager, 'addFiles').mockImplementation(async (path, options) => {
      if (path === paths[1] && fail) { fail = false; throw Error('Generated second-file failure'); }
      await add(path, options);
    });
    const controller = new SourceSelectionController((path, options) => manager.addFiles(path, options));
    const selected = controller.select([...paths]);
    expect(selected.names).toEqual(['generated-first.md', 'generated-second.md']); expect(JSON.stringify(selected)).not.toContain(root);
    await expect(controller.confirm(selected.selectionId, DEFAULT_SOURCE_OPTIONS)).rejects.toThrow('second-file failure');
    expect(manager.status()).toHaveLength(1); const firstId = manager.status()[0].source.id;
    await controller.confirm(selected.selectionId, DEFAULT_SOURCE_OPTIONS);
    expect(manager.status()).toHaveLength(2); expect(manager.status().some(row => row.source.id === firstId)).toBe(true);
    expect(addFiles.mock.calls.map(call => call[0])).toEqual([paths[0], paths[1], paths[1]]);
    await expect(controller.confirm(selected.selectionId, DEFAULT_SOURCE_OPTIONS)).rejects.toThrow('已失效');
    expect(manager.status()).toHaveLength(2);
  } finally { await manager.close(); vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); }
});

it('rejects replaced, cancelled and invented selection identities while retaining a selection after invalid options', async () => {
  const addFiles = vi.fn(async () => {}), controller = new SourceSelectionController(addFiles);
  const old = controller.select(['/generated/private/one.md']);
  const current = controller.select(['/generated/private/two.md']);
  await expect(controller.confirm(old.selectionId, DEFAULT_SOURCE_OPTIONS)).rejects.toThrow('已失效');
  await expect(controller.confirm('/generated/private/one.md', DEFAULT_SOURCE_OPTIONS)).rejects.toThrow('已失效');
  await expect(controller.confirm(current.selectionId, { ...DEFAULT_SOURCE_OPTIONS, retention: 'invalid' })).rejects.toThrow();
  expect(addFiles).not.toHaveBeenCalled();
  await controller.confirm(current.selectionId, DEFAULT_SOURCE_OPTIONS);
  expect(addFiles).toHaveBeenCalledTimes(1); expect(addFiles.mock.calls[0][0]).toBe('/generated/private/two.md');
  const cancelled = controller.select(['/generated/private/three.md']); controller.cancel(cancelled.selectionId);
  await expect(controller.confirm(cancelled.selectionId, DEFAULT_SOURCE_OPTIONS)).rejects.toThrow('已失效');
  expect(addFiles).toHaveBeenCalledTimes(1);
});
