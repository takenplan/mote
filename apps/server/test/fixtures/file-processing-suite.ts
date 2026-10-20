import {decodeSourceText} from '@mote/shared';
import {fixtureCaptureRefs} from './evidence-refs.js';
import {fixtureMemoryResult,fixtureMemoryPipeline} from './memory-result.js';
import {fixtureFilePolicy} from './file-policy.js';
import {ServerDiagnostics} from '../../src/diagnostics.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';
import {type Plugin} from '@deepseek-ai/cordis';
import {ProviderFailure,providerHttpFailure,type Transcript,diarizationSchema,transcriptSchema,fileProcessingSchema} from '@mote/shared';
import {Store,sha256} from '../../src/store.js';
import {SourceStore} from '../../src/sources.js';
import {FileStore} from '../../src/files.js';
import {FileProcessing,HttpTranscriptionProvider} from '../../src/file-processing.js';
import {ExecutionEngine} from '../../src/execution-engine.js';
import {FileProcessorRuntime} from '../../src/file-processors.js';
import {alignDialogue,applySemanticGroups} from '../../src/file-dialogue.js';
import {FileReviews} from '../../src/file-reviews.js';
import {defaultFileOutput,defaultFileRecipe,FileOutputRegistry,FileRecipeRegistry,installFileRecipes} from '../../src/file-recipes.js';
import {Conversations} from '../../src/conversations.js';
import {fileExportEntries,exportTar} from '../../src/file-export.js';
import {MemoryStore,memoryEvidenceFingerprint} from '../../src/memory.js';
import {MemoryPipeline} from '../../src/memory-pipeline.js';
import {MaterialStore,materialId} from '../../src/materials.js';
import {MaterialOrganizerRuntime} from '../../src/material-organizers.js';
import {MaterialMemoryWork} from '../../src/material-memory-work.js';
import {Operations} from '../../src/operations.js';
import {EvidenceReader} from '../../src/evidence-reader.js';
import {evidenceDependents} from '../../src/evidence-dependencies.js';
import {sourceMaterialView} from '../../src/source-material-view.js';

const formalValue=(record:{ocrText:string}):any=>decodeSourceText('speech-text-v2',record.ocrText)??{text:record.ocrText};

const raw:Transcript={durationMs:3000,segments:[{startMs:0,endMs:1000,text:'使用扣迪斯插件。',words:[{startMs:0,endMs:300,text:'使用'},{startMs:300,endMs:700,text:'扣迪斯'},{startMs:700,endMs:1000,text:'插件。'}]},{startMs:1500,endMs:2500,text:'嗯，对，尚未完成。'}]};

const wave=Buffer.alloc(32044);

wave.write('RIFF');

wave.writeUInt32LE(wave.length-8,4);

wave.write('WAVEfmt ',8);

wave.writeUInt32LE(16,16);

wave.writeUInt16LE(1,20);

wave.writeUInt16LE(1,22);

wave.writeUInt32LE(16000,24);

wave.writeUInt32LE(32000,28);

wave.writeUInt16LE(2,32);

wave.writeUInt16LE(16,34);

wave.write('data',36);

wave.writeUInt32LE(32000,40);

const diary=diarizationSchema.parse({durationMs:3000,engine:'synthetic',expectedSpeakers:2,observedSpeakers:2,overlapDetection:'unknown',segments:[{startMs:0,endMs:1100,speaker:'SPEAKER_0'},{startMs:1400,endMs:2600,speaker:'SPEAKER_1'}],samples:[{speaker:'SPEAKER_0',startMs:0,endMs:1000,wavBase64:wave.toString('base64')}]});

const overlappingRaw:Transcript={durationMs:3000,segments:[
 {startMs:0,endMs:2200,text:'Alpha beta',words:[{startMs:0,endMs:700,text:'Alpha '},{startMs:1800,endMs:2200,text:'beta'}]},
 {startMs:1500,endMs:2800,text:'Gamma delta',words:[{startMs:1500,endMs:2100,text:'Gamma '},{startMs:2600,endMs:2800,text:'delta'}]},
]};

const overlappingDiarization={...diary,segments:[{startMs:0,endMs:1700,speaker:'SPEAKER_0'},{startMs:1900,endMs:3000,speaker:'SPEAKER_1'}]};

async function fixture(t:any,options:any={}){
 const dir=mkdtempSync(join(tmpdir(),'mote-processing-')),store=new Store(dir,{dataKey:'41'.repeat(32),contentEncryptionEnabled:true}),sources=new SourceStore(store),files=new FileStore(store,sources);
 sources.register({id:'phone',name:'Synthetic phone',kind:'local-files',deviceId:'phone',platform:'android',retention:'archive'});
 const bytes=options.file?.bytes??wave,filename=options.file?.name??'fixture.wav';
 const manifest={sourceId:'phone',item:{externalId:filename,revision:'1',observedAt:new Date().toISOString(),title:options.file?.name??'Synthetic interview.wav',kind:'file',layer:'original',text:'',mimeType:options.file?.mimeType??'audio/wav',deleted:false},sizeBytes:bytes.length,sha256:sha256(bytes)};
 const begun=files.begin(manifest,()=>{});files.part(begun.uploadId,0,bytes,()=>{});const ack=await files.commit(begun.uploadId,()=>{});let asrCalls=0,diaryCalls=0,summaries=0,disposed=false;
 const plugin:Plugin={name:'fixture-diarizer',inject:['moteFileProcessors'],apply(ctx){ctx.effect(()=>{const dispose=ctx.moteFileProcessors.register({id:'fixture.diarize',name:'Synthetic diarizer',version:'1',stage:'diarize',localOnly:true,mediaTypes:['audio/'],async process(input){diaryCalls++;if(options.failFirst&&diaryCalls===1)throw Error('generated failure');return options.diarize?options.diarize(input):options.diarization??diary;}});return()=>{disposed=true;dispose();};});}};
 const diagnostics=new ServerDiagnostics({directory:join(dir,'logs'),debug:true});await diagnostics.init();
 const instances:FileProcessing[]=[];const createProcessing=(executor?:ExecutionEngine)=>{const instance=new FileProcessing(files,{transcribe:async input=>{asrCalls++;return options.transcribe?options.transcribe(input):raw;}},async()=>{summaries++;throw Error('Unexpected cloud summary');},{executor,plugins:[plugin],analyze:options.analyze,diagnostics,configuration:instances.at(-1)?.configurationSnapshot()});instances.push(instance);return instance;};const processing=createProcessing();
 await processing.runtime.ready;
 processing.update({revision:processing.view().revision,settings:{...processing.view().settings,enabled:true,audioProcessor:'audio.local-dialogue',diarizationProcessor:'fixture.diarize',speakerCount:2,summarize:false,...options.settings},policy:fixtureFilePolicy({...processing.view().settings,enabled:true,audioProcessor:'audio.local-dialogue',diarizationProcessor:'fixture.diarize',speakerCount:2,summarize:false,...options.settings},processing.runtime.registry)});
 t.after(async()=>{for(const instance of instances)await instance.close();await diagnostics.close();store.close();rmSync(dir,{recursive:true,force:true});});
 return {dir,store,sources,files,processing,createProcessing,diagnostics,id:ack.id,counts:()=>({asrCalls,diaryCalls,summaries,disposed})};
}

export {formalValue,raw,wave,diary,overlappingRaw,overlappingDiarization,fixture};
