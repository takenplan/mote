import {LarkDocumentAdapter} from './lark-document-adapter.js';
import {legacyLarkContext} from './lark-legacy.js';
import type {ConnectorContext} from './types.js';
import type {LarkSelection} from '@mote/shared';
import type {LarkCommand} from './lark-cli.js';
export * from './lark-document-adapter.js';
export class LarkDocumentSync extends LarkDocumentAdapter {
 constructor(ctx:ConnectorContext,account:string,sourceId:string,selection:LarkSelection,run:(command:LarkCommand)=>Promise<string>,fence:()=>Promise<void>,authorize:()=>void){super(legacyLarkContext(ctx),account,sourceId,selection,run,fence,authorize);}
}
