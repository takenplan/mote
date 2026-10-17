import {parseEvidenceRef,formatEvidenceRef,parseArtifactRef} from '@mote/shared';
function normalizePublicReference(value:string):string|null {
 if(value.startsWith('context:')){
  const target=parseEvidenceRef(value.slice('context:'.length));
  return target?.kind==='capture'?'context:'+formatEvidenceRef(target.kind,target.id):null;
 }
 const parsed=parseEvidenceRef(value);
 if(parsed)return formatEvidenceRef(parsed.kind,parsed.id);
 if(/^material:mat_[a-f0-9]{64}@[a-f0-9]{64}$/.test(value)||parseArtifactRef(value))return value;
 return null;
}
/** UI routing metadata only. The enclosed reference stays an M08 public ref;
 * the reader boundary must never be guessed from UUID equality or a 404. */
export function contextEvidenceReference(value:string):string{
 const parsed=parseEvidenceRef(value);
 return parsed?.kind==='capture'?'context:'+formatEvidenceRef(parsed.kind,parsed.id):value;
}
/** Strip UI routing metadata only when it encloses a typed context capture. */
export function contextReaderReference(value:string):string|undefined{
 return value.startsWith('context:')&&parseEvidenceRef(value.slice(8))?.kind==='capture'?value.slice(8):undefined;
}
export function readEvidenceRoute(hash:string):string|null {
 const value=new URLSearchParams(hash.split('?')[1]??'').get('evidence');
 return value?normalizePublicReference(value):null;
}
export function evidenceRoute(hash:string,id:string|null):string {
 const [base,search]=hash.split('?'),query=new URLSearchParams(search);
 if(id){const ref=normalizePublicReference(id);if(!ref)throw new Error('A typed evidence reference is required');query.set('evidence',ref);}else query.delete('evidence');
 return (base||'#/today')+(query.size?'?'+query:'');
}
/** One reversible detail entry retains its origin route and other query filters. */
export function changeEvidenceRoute(browser:Pick<Window,'location'|'history'>,id:string|null):string|null {
 const current=browser.location.hash,next=evidenceRoute(current,id),state=browser.history.state;
 if(next===current)return readEvidenceRoute(next);
 if(id){
  if(readEvidenceRoute(current))browser.history.replaceState(state,'',next);
  else browser.history.pushState({...state,moteEvidenceReturn:current},'',next);
 }else if(typeof state?.moteEvidenceReturn==='string'&&evidenceRoute(current,null)===state.moteEvidenceReturn){browser.history.back();}
 else browser.history.replaceState(state,'',next);
 return readEvidenceRoute(next);
}
