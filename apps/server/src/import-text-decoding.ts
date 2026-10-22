/** Encoding is a transport declaration, not a semantic guess. A BOM permits
 * UTF-16; otherwise the bytes must be valid UTF-8. */
export function importTextEncoding(prefix:Uint8Array):'utf-8'|'utf-16le'|'utf-16be'{
 if(prefix[0]===0xff&&prefix[1]===0xfe)return 'utf-16le';
 if(prefix[0]===0xfe&&prefix[1]===0xff)return 'utf-16be';
 return 'utf-8';
}
export type ImportDecodeOutcome={fileId:string;status:'decoded'|'unsupported';decoder?:string;reason:string};
