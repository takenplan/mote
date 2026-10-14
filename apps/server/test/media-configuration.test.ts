import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.js';
import {SourceStore} from '../src/sources.js';
import {FileStore} from '../src/files.js';
import {FileProcessing} from '../src/file-processing.js';
import {FileProcessorRuntime} from '../src/file-processors.js';
import {Perception} from '../src/perception.js';
import {MediaAssets} from '../src/media-assets.js';
import {DEFAULT_MEDIA_OCR_ENDPOINT} from '../src/media-configuration.js';

test('managed media uses the injected startup snapshot and keeps worker credentials out of views',async t=>{
  const directory=mkdtempSync(join(tmpdir(),'mote-media-config-')),store=new Store(directory);
  const media={ocrEndpoint:'http://127.0.0.1:19910/ocr',asrEndpoint:'http://127.0.0.1:19909/transcribe',workerToken:'generated-worker-credential'};
  const assets=new MediaAssets(join(directory,'models')),files=new FileStore(store,new SourceStore(store));
  const processing=new FileProcessing(files,undefined,undefined,{mediaAssets:assets,media});
  t.after(async()=>{await processing.close();store.close();rmSync(directory,{recursive:true,force:true});});
  await processing.runtime.ready;
  assert.equal(processing.imageDefault().services[0].endpoint,media.ocrEndpoint);
  assert.equal(processing.imageConfiguration('', 'image/png').settings.apiKey,media.workerToken);
  assert.equal(processing.localService('asr-local').endpoint,media.asrEndpoint);
  assert.equal(processing.localService('asr-local').apiKey,media.workerToken);
  assert.ok(!JSON.stringify(processing.view()).includes(media.workerToken));
  media.ocrEndpoint='http://127.0.0.1:29910/ocr';media.workerToken='a-later-candidate';
  assert.equal(processing.imageDefault().services[0].endpoint,'http://127.0.0.1:19910/ocr');
  assert.equal(processing.imageConfiguration('', 'image/png').settings.apiKey,'generated-worker-credential');
});

test('legacy managed OCR accepts an injected endpoint while ambient media variables do not change defaults',async t=>{
  const previous=process.env.MOTE_MEDIA_OCR_ENDPOINT;process.env.MOTE_MEDIA_OCR_ENDPOINT='https://ambient.example.invalid/ocr';
  const directory=mkdtempSync(join(tmpdir(),'mote-media-default-')),store=new Store(directory),runtime=new FileProcessorRuntime();
  const assets=new MediaAssets(join(directory,'models'));
  const perception=new Perception(store,runtime,undefined,assets,async()=>true,{ocrEndpoint:'http://127.0.0.1:19911/ocr'});
  const processing=new FileProcessing(new FileStore(store,new SourceStore(store)));
  t.after(async()=>{if(previous===undefined)delete process.env.MOTE_MEDIA_OCR_ENDPOINT;else process.env.MOTE_MEDIA_OCR_ENDPOINT=previous;await perception.close();await processing.close();await runtime.close();store.close();rmSync(directory,{recursive:true,force:true});});
  await runtime.ready;await processing.runtime.ready;
  assert.equal(perception.settings().ocrEndpoint,'http://127.0.0.1:19911/ocr');
  assert.equal(processing.imageDefault().services[0].endpoint,DEFAULT_MEDIA_OCR_ENDPOINT);
});
