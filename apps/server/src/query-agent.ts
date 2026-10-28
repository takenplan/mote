import type {QueryInput} from '@mote/agent';
import type {QueryResult} from '@mote/shared';

/** Model adapter contract; independent of server assembly and HTTP transport. */
export interface QueryAgent {
  configured:boolean;
  configuredFor?(id:string):boolean;
  query(args:QueryInput):Promise<QueryResult>;
  close():Promise<void>;
}
