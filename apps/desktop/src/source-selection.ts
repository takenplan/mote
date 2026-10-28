import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { moteText } from '@mote/shared/i18n';
import { normalizeSourceOptions } from './source-types';
import type { SourceOptions } from './contracts/sources';

/** Native selections stay privileged; the renderer receives only an opaque confirmation identity. */
export class SourceSelectionController {
  private readonly selections = new Map<string, string[]>();
  constructor(private readonly addFiles: (path: string, options: SourceOptions) => Promise<void>) {}

  select(paths: string[]): { canceled: false; selectionId: string; names: string[] } {
    this.selections.clear();
    const selectionId = randomUUID(); this.selections.set(selectionId, paths);
    return { canceled: false, selectionId, names: paths.map(path => basename(path)) };
  }

  cancel(id: unknown): void { if (typeof id === 'string') this.selections.delete(id); }

  async confirm(id: unknown, input: unknown): Promise<void> {
    const paths = typeof id === 'string' ? this.selections.get(id) : undefined;
    if (!paths) throw new Error(moteText('文件选择已失效，请重新选择'));
    const options = normalizeSourceOptions(input);
    // Remove each success immediately: retry after a partial failure never duplicates it.
    while (paths.length) { await this.addFiles(paths[0], options); paths.shift(); }
    this.selections.delete(id as string);
  }
}
