import {navigationScope,navigationRef,type NavigationExpansion} from './context-navigation.js';
import {createHash} from 'node:crypto';
import {sourceContentTime,formatEvidenceRef,type CaptureRecord,type SourceConnection} from '@mote/shared';
import type {Memory} from './memory-schema.js';
import type {Range} from './store.js';
import {StoreError} from './execution-storage.js';
export type ContextQueryInput = Range & {
  query?:string;
  projectKey?:string;
  repositoryKey?:string;
  provider?:'claude'|'codex'|'kimi';
  sessionId?:string;
  cursor?:string;
  limit?:number;
  maxCharacters?:number;
  includeRecentSessions?:boolean;
  includeMemories?:boolean;
};

export type ContextOrigin = {
  source:string;
  sourceId?:string;
  deviceId:string;
  appName:string;
  capturedAt:string;
  receivedAt:string;
  provider?:'claude'|'codex'|'kimi';
  sessionId?:string;
  projectKey?:string;
  repositoryKey?:string;
  projectName?:string;
  branch?:string;
};

export type ContextCard = {
  ref:string;
  id:string;
  kind:string;
  title:string;
  snippet:string;
  matchReasons:string[];
  origin:ContextOrigin;
  revision?:string;
  locator?:{offset:number;length:number;totalLength:number};
  evidenceRefs:string[];
  status?:string;
  applicability?:string;
  expansion?:NavigationExpansion;
};

export type ContextCoverage = {
  recordsScanned:number;
  recordsReturned:number;
  memoriesScanned:number;
  memoriesReturned:number;
  originalLatestAt:string|null;
  memoryLatestAt:string|null;
  sourceStates:Array<{id:string;name:string;state:string;lastSyncAt?:string}>;
  truncated:boolean;
};

export type ContextPage = {
  items:ContextCard[];
  coverage:ContextCoverage;
  nextCursor:string|null;
  truncated:boolean;
};

export type ContextReadItem = {
  evidenceCount?:number;
  evidenceRefsTruncated?:boolean;
  expansion?:NavigationExpansion;
  ref:string;
  id:string;
  kind:string;
  text:string;
  textRange:{offset:number;total:number;nextOffset:number|null};
  title?:string;
  origin?:ContextOrigin;
  evidenceRefs?:string[];
  status?:string;
  applicability?:string;
};

export type ContextReadPage = {
  items:ContextReadItem[];
  missingRefs:string[];
  truncated:boolean;
};

export type ContextBundle = {
  stableMemories:ContextCard[];
  recentSessions:ContextCard[];
  recentRecords:ContextCard[];
  coverage:ContextCoverage;
  nextCursor:string|null;
  truncated:boolean;
};

export type CodingScope={provider:'claude'|'codex'|'kimi';sessionId:string;projectKey:string;repositoryKey?:string;projectName?:string;branch?:string};
export type Cursor={kind:'browse'|'search';hash:string;inner?:string|null};
export const position=(r:CaptureRecord)=>Buffer.from(JSON.stringify({t:new Date(sourceContentTime(r)).toISOString(),id:r.id})).toString('base64url');

export const MAX_SCAN=200;
export const DEFAULT_LIMIT=20;
export const MAX_LIMIT=100;
export const DEFAULT_SNIPPET=400;
export const MAX_RESPONSE_CHARACTERS=16000;

export function codingScope(record:CaptureRecord):CodingScope|undefined {
  const value=record.provenance?.document?.coding;
  return value?{provider:value.provider,sessionId:value.sessionId,projectKey:value.projectKey,...(value.repositoryKey?{repositoryKey:value.repositoryKey}:{}),...(value.projectName?{projectName:value.projectName}:{}),...(value.branch?{branch:value.branch}:{})}:undefined;
}

export function hashQuery(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,24);}
export function encodeCursor(value:Cursor){const {inner,...rest}=value;return Buffer.from(JSON.stringify({...rest,...(inner?{position:JSON.parse(Buffer.from(inner,'base64url').toString())}:{})})).toString('base64url');}
export function decodeCursor(value:string|undefined,kind:'browse'|'search',query:unknown):Cursor|undefined {
  if(!value)return;
  try {
    const parsed=JSON.parse(Buffer.from(value,'base64url').toString()) as Cursor;
    if(parsed.kind!==kind||parsed.hash!==hashQuery(query))throw Error();
    const position=(parsed as Cursor & {position?:unknown}).position;
    return {...parsed,...(position?{inner:Buffer.from(JSON.stringify(position)).toString('base64url')}:{})};
  } catch {throw new StoreError('Invalid context cursor');}
}

export function boundLimit(value:number|undefined){return Math.max(1,Math.min(value??DEFAULT_LIMIT,MAX_LIMIT));}
export function lower(value:string){return value.toLocaleLowerCase();}

export function searchableText(record:CaptureRecord){
  const media=record.metadata?.media?.sessions.flatMap(session=>[session.appId,session.appName,session.title,session.artist,session.album,session.displaySubtitle,session.mediaId] as (string|undefined)[]).filter(Boolean)??[];
  return [record.appName,record.windowTitle,record.ocrText,record.mood,...media,record.metadata?JSON.stringify(record.metadata):''].filter(Boolean).join('\n');
}

export function snippet(text:string,query:string|undefined,maxLength=DEFAULT_SNIPPET){
  const value=text||'';
  if(!value)return {text:'',locator:undefined};
  const terms=(query?.trim().split(/\s+/u).filter(Boolean)??[]).slice(0,12);
  const lowered=lower(value);
  let hit=-1,hitLength=0;
  for(const term of terms){const at=lowered.indexOf(lower(term));if(at>=0&&(hit<0||at<hit)){hit=at;hitLength=term.length;}}
  if(hit<0)return {text:value.slice(0,maxLength),locator:undefined};
  const radius=Math.max(40,Math.floor((maxLength-hitLength)/2));
  const start=Math.max(0,hit-radius),end=Math.min(value.length,start+maxLength);
  return {text:value.slice(start,end),locator:{offset:start,length:hitLength,totalLength:value.length}};
}

export function recordOrigin(record:CaptureRecord):ContextOrigin {
  const scope=codingScope(record),p=record.provenance;
  return {source:record.source,deviceId:record.deviceId,appName:record.appName,capturedAt:record.capturedAt,receivedAt:record.receivedAt,
    ...(p?.sourceId?{sourceId:p.sourceId}:{}),...(scope?scope:{}),};
}

export function matches(record:CaptureRecord,args:ContextQueryInput,requireText=false){
  const scope=codingScope(record),p=record.provenance;
  if(requireText&&args.query){
    const haystack=lower([searchableText(record),scope?.projectKey,scope?.projectName,scope?.repositoryKey,scope?.sessionId,scope?.provider].filter(Boolean).join('\n'));
    for(const term of args.query.trim().split(/\s+/u).filter(Boolean).slice(0,12))if(!haystack.includes(lower(term)))return false;
  }
  if(p?.deleted)return false;
  return true;
}

export function kind(record:CaptureRecord){
  if(record.provenance?.document?.coding)return 'conversation';
  if(record.source==='note')return 'note';
  if(record.source==='file')return 'file';
  return record.source;
}

export function contextCard(record:CaptureRecord,query?:string,extra?:Partial<ContextCard>):ContextCard {
  const scope=codingScope(record),body=record.ocrText||record.windowTitle||(record.metadata?.media?searchableText(record):record.appName);
  const match=snippet(body,query);
  const reasons:string[]=[];
  if(query)reasons.push(match.locator?'literal text match':'metadata or prefix match');
  if(scope?.projectKey)reasons.push(`projectKey=${scope.projectKey}`);
  if(scope?.sessionId)reasons.push(`sessionId=${scope.sessionId}`);
  return {ref:formatEvidenceRef('capture',record.id),id:record.id,kind:kind(record),title:(record.windowTitle||record.appName||record.source).slice(0,200),snippet:match.text,matchReasons:reasons,origin:recordOrigin(record),
    ...(record.provenance?.revision?{revision:record.provenance.revision}:{}),...(match.locator?{locator:match.locator}:{}),evidenceRefs:[formatEvidenceRef('capture',record.id)],...extra};
}

export function pageCoverage(records:number,items:number,memories:number,sources:SourceConnection[],stats:{lastCaptureAt?:string|null},memoryLatestAt:string|null,truncated:boolean):ContextCoverage {
  return {recordsScanned:records,recordsReturned:items,memoriesScanned:memories,memoriesReturned:memories,originalLatestAt:stats.lastCaptureAt??null,memoryLatestAt,
    sourceStates:sources.map(source=>({id:source.id,name:source.name,state:source.status?.state??'unknown',...(source.status?.lastSyncAt?{lastSyncAt:source.status.lastSyncAt}:{})})),truncated};
}

export function cardFromMemory(memory:Pick<Memory,'id'|'title'|'status'|'createdAt'|'evidenceIds'>&Partial<Memory>):ContextCard {
  const scope=memory.scopeRefs?.[0],capturedAt=memory.createdAt;
  return {ref:formatEvidenceRef('memory',memory.id),id:memory.id,kind:'memory',title:memory.title,snippet:memory.statement?.slice(0,DEFAULT_SNIPPET)??'',matchReasons:['published memory','evidence-linked'],origin:{source:'memory',deviceId:scope?.deviceId??'memory',appName:'Mote memory',capturedAt,receivedAt:capturedAt,...(scope??{})},evidenceRefs:(memory.evidenceIds as string[]).map(id=>formatEvidenceRef('capture',id)),status:memory.status,applicability:memory.coding?.applicability??memory.admission?.scope};
}

/** Overview projections expose their Memory ref without disclosing original IDs. */
export function cardFromMemoryOverview(memory:Pick<Memory,'id'|'title'|'status'|'createdAt'>&Partial<Memory>):ContextCard {
  return cardFromMemory({...memory,evidenceIds:[]});
}

export const CONTEXT_DIRECTORIES=[
 {path:'/context/memory',layer:'L3/L4',description:'Selected candidate and long-term memories',expand:'memories'},
 {path:'/context/episodes',layer:'L2',description:'Bounded segments and semantic interpretations',expand:'segments'},
 {path:'/context/sources',layer:'L0/L1',description:'Original source catalog; exact or fresh evidence remains directly searchable',expand:'sources'},
] as const;


/** Existing minimum-budget navigation card; keep its stable expansion reference. */
export function compactContextCard(card:ContextCard){card.snippet='';card.title=card.title.slice(0,64);card.matchReasons=[];card.evidenceRefs=[];delete card.applicability;delete card.expansion;card.origin={source:card.origin.source,deviceId:card.origin.deviceId,appName:'',capturedAt:card.origin.capturedAt,receivedAt:card.origin.receivedAt};delete card.revision;}
