import {RESET_REQUIRED} from './storage-format';
import { moteText } from '@mote/shared/i18n';
import {accountKey} from './account';
import { readFile } from 'node:fs/promises';
import type { Config } from './contracts';
import { atomicSourceJson } from './source-sync';
type Connection = Pick<Config, 'serverUrl' | 'token' | 'account'>;
export type Binding = { kind: 'unbound' | 'unknown' } | { kind: 'bound'; origin: string; deploymentId:string; userId:string };
export function connectionBinding(config: Connection): Binding {
  return accountKey(config) ? {kind:'bound',origin:config.serverUrl,deploymentId:config.account!.deploymentId,userId:config.account!.userId} : {kind:'unbound'};
}
/** Independent of editable config: clearing a URL cannot make old personal data unbound. */
export class ConnectionBindingStore {
  private value: Binding = { kind: 'unknown' };
  constructor(private path: string, private readonly write: (path: string, value: unknown) => Promise<void> = atomicSourceJson) {}
  async initialize(config: Connection, hasData: boolean): Promise<void> {
    try {
      const value = JSON.parse(await readFile(this.path, 'utf8')) as Binding;
      if (!['bound', 'unbound', 'unknown'].includes(value.kind) || (value.kind === 'bound' && (typeof value.origin !== 'string' || !/^https?:\/\//.test(value.origin) || typeof value.deploymentId!=='string'||!value.deploymentId||typeof value.userId!=='string'||!value.userId||Object.hasOwn(value,'credentialHash')))) throw new Error(RESET_REQUIRED);
      this.value = value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      if(hasData)throw Error(RESET_REQUIRED);
      this.value = connectionBinding(config);
      await this.write(this.path, this.value);
    }
  }
  unbound(): boolean { return this.value.kind === 'unbound'; }
  snapshot(): Binding { return { ...this.value }; }
  matches(config: Connection): boolean { return JSON.stringify(this.value) === JSON.stringify(connectionBinding(config)); }
  assertChange(config: Connection, pending: boolean, confirmedInitial = false, sameNodeReauthorization = false): void {
    const target = connectionBinding(config);
    if (this.matches(config)) return;
    if(this.value.kind==='bound')throw Error('Local data belongs to another deployment or account');
    if (!pending) return;
    if (this.unbound() && target.kind === 'bound' && confirmedInitial) return;
    throw new Error(moteText("本地待上传记录已绑定原节点或凭据，不能重新归属；请恢复原连接完成同步"));
  }
  async commit(config: Connection, pending: boolean, confirmedInitial = false, sameNodeReauthorization = false): Promise<void> {
    this.assertChange(config, pending, confirmedInitial, sameNodeReauthorization);
    const next = connectionBinding(config);
    await this.write(this.path, next); this.value = next;
  }
}
