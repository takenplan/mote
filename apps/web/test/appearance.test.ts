import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import {AppearanceStore,createBrowserAppearance,appearanceStorageKey,linearUiTheme,applyAppearanceTheme} from '@mote/shared';

function fixture(blocked=false) {
 const dom=new JSDOM('<meta name="theme-color"><textarea>Generated unsaved draft</textarea><dialog open>Generated dialog</dialog>',{url:'https://generated.invalid/#/ask'});
 const query=new dom.window.EventTarget() as EventTarget&{matches:boolean};query.matches=false;
 Object.defineProperty(dom.window,'matchMedia',{value:()=>query});
 if(blocked)Object.defineProperty(dom.window,'localStorage',{get(){throw Error('Generated storage denial');}});
 return {dom,query,store:createBrowserAppearance(dom.window as unknown as Window)};
}
test('browser preference persists the three-state choice; storage events, live OS and resume agree',()=>{
 const {dom,query,store}=fixture();
 try {
  query.matches=true;query.dispatchEvent(new dom.window.Event('change'));
  assert.deepEqual(store.getSnapshot(),{preference:'auto',scheme:'dark'});
  assert.ok(store.save('light'));query.matches=false;query.dispatchEvent(new dom.window.Event('change'));query.matches=true;query.dispatchEvent(new dom.window.Event('change'));
  assert.equal(store.getSnapshot().scheme,'light');assert.equal(dom.window.localStorage.getItem(appearanceStorageKey),'light');
  store.save('auto');assert.equal(store.getSnapshot().scheme,'dark');assert.equal(dom.window.localStorage.getItem(appearanceStorageKey),'auto');
  query.matches=false;dom.window.dispatchEvent(new dom.window.Event('pageshow'));assert.equal(store.getSnapshot().scheme,'light');
  dom.window.localStorage.setItem(appearanceStorageKey,'dark');dom.window.dispatchEvent(new dom.window.StorageEvent('storage',{key:appearanceStorageKey}));assert.equal(store.getSnapshot().preference,'dark');
  dom.window.localStorage.setItem(appearanceStorageKey,'light');dom.window.dispatchEvent(new dom.window.Event('pageshow'));assert.equal(store.getSnapshot().preference,'light');
  store.dispose();query.matches=true;query.dispatchEvent(new dom.window.Event('change'));assert.equal(store.getSnapshot().preference,'light');
 }finally{store.dispose();dom.window.close();}
});
test('new, corrupt or rejected storage falls back to auto including a rejected write',()=>{
 for(const blocked of [false,true]){
  const {dom,query,store}=fixture(blocked);
  try{
   if(!blocked){dom.window.localStorage.setItem(appearanceStorageKey,'corrupt');dom.window.dispatchEvent(new dom.window.StorageEvent('storage',{key:appearanceStorageKey}));}
   query.matches=true;query.dispatchEvent(new dom.window.Event('change'));assert.deepEqual(store.getSnapshot(),{preference:'auto',scheme:'dark'});
   if(blocked){assert.equal(store.save('light'),false);assert.equal(store.getSnapshot().preference,'auto');}
  }finally{store.dispose();dom.window.close();}
 }
});
test('appearance changes preserve actual draft nodes, selection, hash and open dialog; native chrome agrees',()=>{
 const {dom}=fixture();const document=dom.window.document,field=document.querySelector('textarea')!,dialog=document.querySelector('dialog')!;
 try{
  field.focus();field.setSelectionRange(4,11);
  for(const scheme of ['dark','light','dark'] as const){
   applyAppearanceTheme(document.documentElement,linearUiTheme,scheme);
   assert.equal(document.querySelector('textarea'),field);assert.equal(field.value,'Generated unsaved draft');assert.equal(field.selectionStart,4);assert.equal(field.selectionEnd,11);
   assert.equal(document.activeElement,field);assert.equal(dom.window.location.hash,'#/ask');assert.ok(dialog.open);
   assert.equal(document.documentElement.style.colorScheme,scheme);assert.equal(document.querySelector<HTMLMetaElement>('meta')!.content,linearUiTheme.schemes![scheme].background);
  }
 }finally{dom.window.close();}
});
test('early local bootstrap precedes application paint, honors explicit preferences, handles denied storage and has no inline CSP exception',()=>{
 const script=readFileSync(new URL('../public/appearance-init.js',import.meta.url),'utf8');
 for(const preference of ['light','dark','auto','broken'])for(const systemDark of [false,true]){
  const dom=new JSDOM('',{url:'https://generated.invalid',runScripts:'outside-only'});
  try{dom.window.localStorage.setItem(appearanceStorageKey,preference);Object.defineProperty(dom.window,'matchMedia',{value:()=>({matches:systemDark})});dom.window.eval(script);
   assert.equal(dom.window.document.documentElement.dataset.colorScheme,preference==='light'?'light':preference==='dark'?'dark':systemDark?'dark':'light');
  }finally{dom.window.close();}
 }
 const dom=new JSDOM('',{runScripts:'outside-only'});try{dom.window.eval(script);assert.equal(dom.window.document.documentElement.dataset.colorScheme,'light');}finally{dom.window.close();}
 assert.deepEqual(new AppearanceStore().getSnapshot(),{preference:'auto',scheme:'light'});
});
