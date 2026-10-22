import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {CaptureRecord} from '@mote/shared';
import {materialOriginalContentVisible} from '../src/material-original-visibility.js';
import {captureEvent,screenGroup,uiPageObject,type MaterialOrganizerReader} from '../src/material-organizer-contract.js';

const record=(source:CaptureRecord['source']='screen',redacted=false):CaptureRecord=>({id:randomUUID(),source,deviceId:'generated-device',deviceName:'Generated device',platform:'import',capturedAt:'2026-10-18T00:00:05Z',receivedAt:'2026-10-18T00:00:05Z',durationMs:2000,appId:'generated.app',appName:'Generated app',windowTitle:'Generated title',ocrText:'GENERATED_PERMITTED_OCR',privacy:{excluded:false,redacted,mode:'local',collection:'content'},blobHash:null,imageMime:null,indexingStatus:'indexed'});
function reader(records:CaptureRecord[]):MaterialOrganizerReader{return {capture:()=>records[0],sourceHead:()=>records[0],screenGroup:()=>({records,truncated:false}),uiPageGroup:()=>({records,truncated:false}),codingSession:()=>({records,truncated:false}),file:()=>undefined};}
function pageRecord(){const r=record('ui_page',true),at=r.capturedAt;r.metadata={version:1,observedAt:at,collector:{method:'accessibility'},uiPage:{version:2,scope:'visible_window',adapterId:'generated.fields',adapterVersion:'1',appVersion:'1',activity:'Generated.Article',status:'ok',truncated:false,observations:{firstAt:at,lastAt:at,count:1},objects:[{kind:'article',title:'Generated article',body:[{text:'GENERATED_SELECTED_UI'}],url:'https://fixture.invalid/selected',identity:{type:'url',value:'https://fixture.invalid/selected'}}]}};return r;}

test('typed Material content visibility blocks raw redacted screens without changing selected UI or measurement input',()=>{
 const raw=record('screen',true),ui=pageRecord(),normal=record();assert.equal(materialOriginalContentVisible(raw),false);assert.equal(materialOriginalContentVisible(ui),true);assert.equal(materialOriginalContentVisible(normal),true);assert.equal(raw.privacy.redacted,true);assert.equal(raw.durationMs,2000);
 assert.equal(materialOriginalContentVisible({...normal,privacy:{...normal.privacy,excluded:true}}),false);assert.equal(materialOriginalContentVisible({...normal,provenance:{sourceId:'generated',externalId:'deleted',revision:'1',layer:'original',deleted:true}}),false);
});

test('shared screen organizer does not promote raw or projected private OCR and retains only permitted members',()=>{
 const raw=record('screen',true);raw.ocrText='GENERATED_PRIVATE_PROJECTED_OCR';const normal=record();const group={deviceId:normal.deviceId,groupKey:'generated-group'},built=screenGroup.build(reader([raw,normal]),group);assert.ok(built);assert.ok(JSON.stringify(built).includes(normal.ocrText));assert.ok(!JSON.stringify(built).includes(raw.ocrText));assert.deepEqual(built.members.map(member=>member.ref),['capture:'+normal.id]);assert.equal(screenGroup.build(reader([raw]),group),undefined);
});

test('shared capture event rejects raw redacted screen products while preserving structured selected UI',()=>{
 const raw=record('screen',true);raw.blobHash='a'.repeat(64);raw.imageMime='image/png';raw.ocrText='GENERATED_PRIVATE_EVENT_OCR';assert.equal(captureEvent.build(reader([raw]),captureEvent.select(raw)!),undefined);
 const ui=pageRecord(),event=captureEvent.build(reader([ui]),captureEvent.select(ui)!);assert.ok(event);assert.ok(JSON.stringify(event).includes('GENERATED_SELECTED_UI'));const object=uiPageObject.build(reader([ui]),uiPageObject.select(ui)!);assert.ok(object);assert.ok(JSON.stringify(object).includes('GENERATED_SELECTED_UI'));
});
