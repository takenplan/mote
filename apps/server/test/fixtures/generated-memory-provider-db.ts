import {DatabaseSync} from 'node:sqlite';

/** Match the live host's existing five-second SQLite lock wait. This changes
 * only generated model IO; host transactions and journey budgets are unchanged. */
export const openGeneratedMemoryProviderDb=(path:string)=>new DatabaseSync(path,{readOnly:true,timeout:5000});
