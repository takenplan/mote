import type {QueryInput} from '@mote/agent';
import type {QueryResult} from '@mote/shared';
export interface QueryAgent {configured:boolean;configuredFor?(id:string):boolean;query(args:QueryInput):Promise<QueryResult>;close():Promise<void>}
