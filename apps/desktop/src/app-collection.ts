import type { CollectionMode, Config } from './contracts';
export type CollectionPolicy = Pick<Config, 'defaultCollection' | 'appCollectionRules'>;
export const NO_COLLECTION: Readonly<CollectionMode> = Object.freeze({duration:false,screenshots:false,structured:false});
export function normalizeCollectionMode(value: unknown): CollectionMode {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 3 || !['duration','screenshots','structured'].every(key => Object.hasOwn(value,key) && typeof (value as Record<string,unknown>)[key] === 'boolean')) throw new Error('Collection channels require duration, screenshots and structured booleans');
  const {duration,screenshots,structured}=value as CollectionMode;
  return {duration,screenshots,structured};
}
export function normalizeAppCollectionRules(value: unknown): Record<string, CollectionMode> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 500) throw new Error('Expected at most 500 application collection rules');
  const result: Record<string, CollectionMode> = {};
  for (const [id, mode] of Object.entries(value)) {
    if (!id.trim() || id !== id.trim() || id.length > 256 || /[\x00-\x20\x7f]/.test(id) || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error('Invalid application Bundle ID');
    Object.defineProperty(result, id, { value: normalizeCollectionMode(mode), enumerable: true, configurable: true, writable: true });
  }
  return result;
}
export const UNKNOWN_FOREGROUND = 'dev.mote.unknown-foreground';
export function hasRestrictedApplications(policy: CollectionPolicy): boolean {
  return !policy.defaultCollection.screenshots || Object.values(policy.appCollectionRules).some(mode => !mode.screenshots);
}
/** Unidentified foregrounds cannot inherit permission to read content or count usage. */
export function collectionForApp(appId: string | undefined, policy: CollectionPolicy): CollectionMode {
  if (!appId || appId === UNKNOWN_FOREGROUND) return {...NO_COLLECTION};
  return Object.hasOwn(policy.appCollectionRules, appId) ? policy.appCollectionRules[appId] : policy.defaultCollection;
}
/** Screen pixels may be read only when every visible application explicitly permits screenshots. */
export function permitsVisibleContent(ids: string[], unknown: boolean, policy: CollectionPolicy): boolean {
  return !unknown && ids.every(id => collectionForApp(id, policy).screenshots);
}
