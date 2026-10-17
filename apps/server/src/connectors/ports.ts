import type {SourceConnection,SourceItem,SourceItemRecord,sourceConnectionSchema} from '@mote/shared';
import type {ConnectorConfig} from './types.js';

/** Production adapters receive transport/storage capabilities, never a Store. */
export interface ConnectorState<T> {read():Promise<T|undefined>;write(value:T):Promise<void>;clear():Promise<void>;flush():Promise<void>}
export interface ConnectorSources {
 register(value:import('zod').z.input<typeof sourceConnectionSchema>):unknown;
 update(id:string,value:Partial<SourceConnection>):unknown;
 getSource(id:string):SourceConnection;
 listSources():SourceConnection[];
 getItem(sourceId:string,id:string):SourceItemRecord|undefined;
 listItems(args:{sourceId:string;after?:string;before?:string;limit:number;cursor?:string}):{items:SourceItemRecord[];nextCursor?:string|null};
 upsert(sourceId:string,item:SourceItem,authorize?:()=>void):Promise<{id:string;duplicate:boolean}>;
 upsertBatch(sourceId:string,items:SourceItem[],authorize?:()=>void):Promise<{receipts:{id:string;duplicate:boolean}[]}>;
 reportStatus(id:string,status:NonNullable<SourceConnection['status']>):unknown;
}
export interface AdapterContext {
 config:{dataDir:string;connectors?:ConnectorConfig};
 sources:ConnectorSources;
 assertCurrent?:()=>void;
 automaticTimers?:boolean;
 state?<T>(name:string):ConnectorState<T>;
 pending?:{set(state:string,value:{verifier:string;expires:number}):void;take(state:string):{verifier:string;expires:number}|undefined;clear():void};
}
export interface GmailPersistence {
 parts(sourceId:string,id:string):string[];
 stale(sourceId:string,epoch:string):string[];
 member(sourceId:string,id:string,epoch?:string):void;
 publish(sourceId:string,messageId:string,message:unknown,items:SourceItem[],authorize:()=>void):Promise<{receipts:{id:string;duplicate:boolean}[]}>;
}
export interface LarkLedger {
 get<T>(account:string,scope:string,key:string):T|undefined;
 set(account:string,scope:string,key:string,value:unknown):void;
 drop(account:string,scope:string,key:string):void;
 rows<T>(account:string,scope:string,prefix:string,limit?:number,errorOnly?:boolean):{key:string;value:T}[];
 forgotten(sourceId:string,id?:string):string[];
 versionExists(sourceId:string,id:string):boolean;
 counts(sourceId:string):{documents:number;activities:number;exists:boolean};
}
export interface LarkContext extends AdapterContext {
 ledger:LarkLedger;
 publishFile(sourceId:string,item:SourceItem,bytes:Buffer,authorize:()=>void,signal:AbortSignal,format?:`processor:${string}`|'recording-audio-backup'):Promise<{id:string;duplicate:boolean}>;
}
