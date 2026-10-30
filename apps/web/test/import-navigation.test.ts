import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import type {Api} from '../src/api.js';
import {captureImportSnapshot,clearImportReturn,importOrigin,importOriginOpener,importSnapshot,markImportReturn,pendingImportReturn,rememberImportOrigin} from '../src/import-navigation.js';

test('an import return belongs to the exact owner and recorded history entry',t=>{
 const dom=new JSDOM('<!doctype html><a href="#/library/import">导入资料</a>',{url:'http://localhost/#/library?view=materials&deviceId=generated'}),prior=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 t.after(()=>{for(const [key,value] of prior)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);dom.window.close();});
 const a={} as Api,b={} as Api,link=dom.window.document.querySelector('a')!;Object.defineProperty(link,'getClientRects',{value:()=>[{}]});
 const origin=rememberImportOrigin(a,dom.window.location.hash,70,link),state={moteImportOrigin:origin.token};assert.equal(importOrigin(a,state,'moteImportOrigin'),origin);assert.equal(importOrigin(b,state,'moteImportOrigin'),undefined);assert.equal(importOrigin(a,dom.window.history.state,'moteImportParent'),origin);assert.equal(importOriginOpener(origin),link);
 const duplicate=link.cloneNode(true) as HTMLAnchorElement;Object.defineProperty(duplicate,'getClientRects',{value:()=>[{}]});dom.window.document.body.append(duplicate);assert.equal(importOriginOpener(origin),undefined,'ambiguous controls never guess an opener');
 assert.equal(importOrigin(a,{moteImportOrigin:'unknown'},'moteImportOrigin'),undefined);
});

test('snapshot belongs to one owner and history visit, and every return has a new read generation',t=>{
 const dom=new JSDOM('<!doctype html><a href="#/library/import">导入资料</a>',{url:'http://localhost/#/library?view=records',pretendToBeVisual:true}),prior=new Map<string,PropertyDescriptor|undefined>();
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement})){prior.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});}
 t.after(()=>{for(const [key,value] of prior)if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);dom.window.close();});
 const a={} as Api,b={} as Api;let cursor='page-two';const dispose=captureImportSnapshot(a,'records',()=>({cursor}));
 const origin=rememberImportOrigin(a,dom.window.location.hash,70,dom.window.document.querySelector('a'));cursor='different-page';markImportReturn(a,origin);const first=pendingImportReturn(a,dom.window.location.hash)!;
 assert.deepEqual(importSnapshot(a,'records'),{cursor:'page-two'});assert.equal(importSnapshot(b,'records'),undefined);clearImportReturn(a,origin);assert.equal(importSnapshot(a,'records'),undefined);
 markImportReturn(a,origin);assert.notEqual(pendingImportReturn(a,dom.window.location.hash)!.visit,first.visit);assert.deepEqual(importSnapshot(a,'records'),{cursor:'page-two'});dispose();
 const discarded=rememberImportOrigin(a,dom.window.location.hash,0,null,false);markImportReturn(a,discarded);assert.equal(importSnapshot(a,'records'),undefined,'a confirmed dirty source is not snapshotted');
});
