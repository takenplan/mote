import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sourceConnectionSchema,type SourceConnection} from '@mote/shared';
import {ScopedRecordingAdapter} from '../src/scope/connector-recordings.js';
import type {ConnectorState,LarkContext} from '../src/connectors/ports.js';

test('recording new-source default resumes its durable initialization after a failed callback and restart',async t=>{
 const directory=mkdtempSync(join(tmpdir(),'mote-generated-recording-default-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));
 let saved:unknown,calls=0;const sources=new Map<string,SourceConnection>(),values=new Map<string,unknown>();
 const key=(scope:string,id:string)=>JSON.stringify([scope,id]);
 const ledger={get:<T>(scope:string,id:string)=>values.get(key(scope,id)) as T|undefined,set:(scope:string,id:string,value:unknown)=>{values.set(key(scope,id),structuredClone(value));},drop:(scope:string,id:string)=>{values.delete(key(scope,id));},rows:<T>(_scope:string,_prefix:string):{key:string;value:T}[]=>[]};
 const ctx:LarkContext={
  config:{dataDir:directory},
  state:<T>()=>({read:async()=>structuredClone(saved) as T|undefined,write:async(value:T)=>{saved=structuredClone(value);},clear:async()=>{saved=undefined;},flush:async()=>{}} satisfies ConnectorState<T>),
  sources:{
   register:input=>{const source=sourceConnectionSchema.parse(input);sources.set(source.id,source);return source;},
   listSources:()=>[...sources.values()],getSource:id=>{const source=sources.get(id);assert.ok(source);return source;},
   update:(id,value)=>{const source=sources.get(id);assert.ok(source);sources.set(id,{...source,...value});},
   getItem:()=>undefined,listItems:()=>({items:[]}),upsert:async()=>{throw Error('Unexpected generated publication');},upsertBatch:async()=>{throw Error('Unexpected generated publication');},reportStatus:()=>{},
  },
  ledger:{get:()=>undefined,set:()=>{},drop:()=>{},rows:()=>[],forgotten:()=>[],versionExists:()=>false,counts:()=>({documents:0,activities:0,exists:false})},
  publishFile:async()=>{throw Error('A connection cannot collect');},
  recordingMemoryDefault:async()=>{calls++;if(calls===1)throw Error('Generated configuration conflict');},
 };
 const open=()=>new ScopedRecordingAdapter(ctx,'dingtalk-recordings',{userId:'generated-owner',instanceId:'generated-instance',directory},{dingtalk:()=>async command=>{if(command.kind==='search')return {minutes:[],complete:true};assert.equal(command.kind,'status');return {authenticated:true,corp_id:'generated-corp',user_id:'generated-user'};}},()=>{},new AbortController().signal,ledger);
 const first=open();await assert.rejects(first.connect(),/Generated configuration conflict/);assert.equal(sources.size,1);const sourceId=[...sources.keys()][0];assert.equal(ledger.get('recording-memory-default',sourceId),true);await first.close();
 const restarted=open();await restarted.select({enabled:true,start:'2026-10-16T00:00:00Z',end:'2026-10-17T00:00:00Z',autoSync:false,backupAudio:true});assert.equal(calls,2,'a saved selection cannot bypass the interrupted default when status already says connected');assert.equal(ledger.get('recording-memory-default',sourceId),undefined);await restarted.close();
 const established=open();await established.connect();assert.equal(calls,2,'an established source without an unfinished initialization never resets its owner-selected recipe');await established.close();
});
