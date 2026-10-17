import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {scopedCaptureFixture} from '../../../server/test/fixtures/scoped-capture-host.js';
export async function recordingFixture(t:TestContext,beforeTranscript?:()=>Promise<void>|undefined){
 const calls:{user:string;kind:string}[]=[],state={audioFails:true,count:2};
 const media=Buffer.alloc(8044);media.write('RIFF');media.writeUInt32LE(media.length-8,4);media.write('WAVEfmt ',8);media.writeUInt32LE(16,16);media.writeUInt16LE(1,20);media.writeUInt16LE(1,22);media.writeUInt32LE(8000,24);media.writeUInt32LE(16000,28);media.writeUInt16LE(2,32);media.writeUInt16LE(16,34);media.write('data',36);media.writeUInt32LE(8000,40);
 const f=await scopedCaptureFixture(t,{connectorTransports:{lark:scope=>async(command)=>{calls.push({user:scope.userId,kind:command.kind});const root=join(scope.directory,'lark-runtime');switch(command.kind){
  case 'status':return JSON.stringify({appId:'cli_generated',identities:{user:{available:true,openId:'same-account'}}});
  case 'minutes-search':return JSON.stringify({data:{items:Array.from({length:state.count},(_,i)=>({token:'recording-'+String(i).padStart(2,'0')})),has_more:false}});
  case 'minutes-metadata':return JSON.stringify({data:{minute:{token:command.id,title:'GENERATED_'+scope.userId+'_'+command.id,create_time:'1790812800000',duration:'500'}}});
  case 'minutes-transcript':{await beforeTranscript?.();const dir=join(root,command.outputDir);mkdirSync(dir,{recursive:true});writeFileSync(join(dir,'transcript.txt'),'Generated export\n\nSpeaker 00:00:00.000\nGENERATED_TEXT_'+scope.userId+'_'+command.id+'\n');return JSON.stringify({data:{minutes:[{minute_token:command.id,artifacts:{transcript_file:command.outputDir+'/transcript.txt'}}]}});}
  case 'minutes-media':if(state.audioFails)throw Error('generated media unavailable');mkdirSync(join(root,command.output.split('/').slice(0,-1).join('/')),{recursive:true});writeFileSync(join(root,command.output),media);return '{}';
  default:throw Error('Unexpected generated CLI '+command.kind);
 }}}});
 const installed=await f.request(f.admin.token,'/api/admin/connectors/feishu-recordings/install','POST',{expectedRevision:f.host.plugins!.catalog.revision(),operationId:crypto.randomUUID()});assert.equal(installed.statusCode,200,installed.body);
 for(const account of [f.a,f.b]){const inventory=(await f.request(account.token,'/api/connectors')).json();const saved=await f.request(account.token,'/api/connectors/same-recorder','PUT',{expectedRevision:inventory.revision,connection:{provider:'feishu-recordings',autoSync:false}});assert.equal(saved.statusCode,200,saved.body);const plugins=(await f.request(account.token,'/api/plugins')).json();const enabled=await f.request(account.token,'/api/connectors/same-recorder/enable','POST',{expectedRevision:plugins.revision});assert.equal(enabled.statusCode,200,enabled.body);}
 return {f,calls,state,media};
}
