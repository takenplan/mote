import type {Status} from './contracts';

/** Window-local drafts follow the selected node and device, never another node. */
export class AskDraftScopes<T> {
  private readonly drafts = new Map<string,T>();
  private key(status:Status):string { return JSON.stringify([status.config.serverUrl,status.config.deviceId]); }
  switch(previous:Status,next:Status,current:T|undefined):T|undefined {
    const oldKey=this.key(previous),newKey=this.key(next);
    if(oldKey===newKey)return current;
    if(current!==undefined)this.drafts.set(oldKey,current);else this.drafts.delete(oldKey);
    const existing=this.drafts.get(newKey);
    if(existing!==undefined){this.drafts.delete(newKey);return existing;}
    // A draft made before the first connection may follow that first connection.
    if(!previous.config.serverUrl&&next.config.serverUrl&&current!==undefined){this.drafts.delete(oldKey);return current;}
    return undefined;
  }
}
