import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {captureSchema,uiPageText} from '../dist/index.js';

const at='2026-10-24T00:00:00.000Z';
function page(){
 const uiPage={version:3,scope:'visible_window',adapterId:'chrome.generated',adapterVersion:'1',appVersion:'1',activity:'',status:'partial',truncated:false,observations:{firstAt:at,lastAt:at,count:1},objects:[{kind:'article',fields:[{name:'body_visible',values:[{text:'Generated visible paragraph',source:'text'}]}]}]};
 return {id:randomUUID(),deviceId:'generated-mac',deviceName:'Generated Mac',platform:'macos',capturedAt:at,durationMs:0,source:'ui_page',appId:'com.google.Chrome',appName:'Chrome',ocrText:uiPageText(uiPage),privacy:{excluded:false,redacted:true,mode:'local',collection:'content'},metadata:{version:1,observedAt:at,collector:{method:'browser_dom'},captureObservation:{id:randomUUID(),objectIndex:0,selected:{duration:false,screenshots:false,structured:true}},uiPage}};
}
test('browser DOM observations preserve extraction source and order while rejecting misattribution and unselected channels',()=>{
 const original=page();const accepted=captureSchema.parse(original);
 assert.equal(accepted.metadata.collector.method,'browser_dom');assert.equal(accepted.metadata.captureObservation.objectIndex,0);
 for(const changed of [
  {...original,platform:'android'}, {...original,appId:'com.tencent.xinWeChat'},
  {...original,durationMs:1000}, {...original,imageMime:'image/jpeg',imageBase64:'AA=='},
  {...original,metadata:{...original.metadata,captureObservation:{...original.metadata.captureObservation,objectIndex:64}}},
  {...original,metadata:{...original.metadata,captureObservation:{...original.metadata.captureObservation,selected:{duration:true,screenshots:false,structured:false}}}},
 ])assert.equal(captureSchema.safeParse(changed).success,false);
});
test('structured-only media facts are accepted with zero measured time, never an implicit playback interval',()=>{
 const base=page();const {uiPage,...metadata}=base.metadata;
 const media={...base,source:'media',ocrText:'',privacy:{excluded:false,redacted:false,mode:'none',collection:'content'},metadata:{...metadata,collector:{method:'media_session'},media:{status:'available',observedAt:at,sessions:[{sessionId:'generated-local-player',appId:'com.google.Chrome',appName:'Chrome',playbackState:'playing',appVisibility:'foreground',playbackType:'local',mediaId:'generated-video',title:'Generated video',positionMs:23000,durationMs:1261000,playbackSpeed:1}]}}};
 assert.equal(captureSchema.safeParse(media).success,true);
 assert.equal(captureSchema.safeParse({...media,durationMs:1000}).success,false);
 const unauthorized={...media,metadata:{...media.metadata,captureObservation:{...media.metadata.captureObservation,selected:{duration:true,screenshots:false,structured:false}}}};
 assert.equal(captureSchema.safeParse(unauthorized).success,false);
});
