import type {DatabaseSync} from 'node:sqlite';

/** The shared engine needs SQLite and metadata admission, not a private archive
 * implementation. Epoch-5 hosts supply this interface without opening a legacy
 * EvidenceStore or installing its schema. */
export interface ExecutionStorage {
 readonly db:DatabaseSync;
 reserveMetadata(bytes:number):void;
}

export class StoreError extends Error {
 constructor(message:string,public statusCode=400){super(message);}
}
