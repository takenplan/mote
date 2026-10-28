/** Shared envelope for CaptureRawReader and FileRawReader only. Authorization,
 * collection matching and current-snapshot validation remain in each reader. */
export type RawPageCursor={collectionRef:string;snapshot:string;offset:number};

export function parseRawPageCursor(cursor:string):RawPageCursor|undefined {
  if(cursor.length>12000)return;
  try {
    const value=JSON.parse(Buffer.from(cursor,'base64url').toString()) as Partial<RawPageCursor>;
    if(typeof value.collectionRef!=='string'||typeof value.snapshot!=='string'||!/^[a-f0-9]{64}$/.test(value.snapshot)||!Number.isSafeInteger(value.offset)||value.offset!<0)return;
    return value as RawPageCursor;
  }catch{return;}
}

export function encodeRawPageCursor(collectionRef:string,snapshot:string,offset:number):string {
  return Buffer.from(JSON.stringify({collectionRef,snapshot,offset})).toString('base64url');
}
