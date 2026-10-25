import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {configureLocale} from '@mote/shared/i18n';
import type {CapturePreview} from '@mote/shared';
import {CaptureCard} from '../src/shell-components';
import type {Api,Capture} from '../src/api';
configureLocale(()=> 'zh-CN');
const capture=(patch:Partial<Capture>={}):Capture=>({id:'11111111-1111-4111-8111-111111111111',deviceId:'generated-device',deviceName:'Generated device',platform:'android',capturedAt:'2026-10-01T00:00:00Z',source:'note',appName:'Generated note',windowTitle:'',durationMs:0,ocrText:'',blobHash:null,privacy:{redacted:false,mode:'none'},...patch} as Capture);
const preview=(value:Capture|CapturePreview)=>new JSDOM(renderToStaticMarkup(React.createElement(CaptureCard,{compact:true,capture:value,api:{} as Api,onOpen:()=>{}}))).window.document.querySelector('.capture-card-body p')!;

test('conversation-only and shared-link records show attributed short previews instead of claiming their body is absent',()=>{
 const quote='Generated <script>untrusted()</script> conversation excerpt '+ 'generated quoted words '.repeat(20);
 const item=capture({metadata:{version:1,observedAt:'2026-10-01T00:00:00Z',noteOrigin:{kind:'conversation',text:quote,conversationId:'generated'}}});
 const p=preview(item);assert.match(p.textContent!,/^对话摘录 · Generated <script>/);assert.ok(p.textContent!.endsWith('…'));assert.ok(p.textContent!.length<180);assert.equal(p.querySelector('script'),null);assert.doesNotMatch(p.textContent!,/此记录没有正文/);
 const shared=preview(capture({metadata:{version:1,observedAt:'2026-10-01T00:00:00Z',noteOrigin:{kind:'share',url:'https://generated.invalid/shared-original'}}}));assert.equal(shared.textContent,'分享内容 · https://generated.invalid/shared-original');
});

test('owner comment takes precedence and attachment-only records show their actual attachment count',()=>{
 const item=capture({ocrText:'Generated owner comment',windowTitle:'Generated title',metadata:{version:1,observedAt:'2026-10-01T00:00:00Z',noteOrigin:{kind:'share',text:'Generated third-party quote'},attachments:['22222222-2222-4222-8222-222222222222']}});
 assert.equal(preview(item).textContent,'Generated owner comment');
 const attachmentOnly=preview(capture({metadata:{version:1,observedAt:'2026-10-01T00:00:00Z',attachments:['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333']}}));assert.equal(attachmentOnly.textContent,'附件 · 2');assert.doesNotMatch(attachmentOnly.textContent!,/此记录没有正文/);
});

test('CapturePreview inputs use their supplied text safely without requiring full-record metadata',()=>{
 const {ocrText:_text,blobHash:_blob,metadata:_metadata,privacy:_privacy,...base}=capture();
 const item={...base,hasImage:false,ocr:{status:'not_applicable'},textPreview:'Generated list preview'} as CapturePreview;
 assert.equal(preview(item).textContent,'Generated list preview');assert.equal(preview({...item,textPreview:''}).textContent,'此记录没有正文');
});
