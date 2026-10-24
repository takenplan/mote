import {describe,expect,it} from 'vitest';
import {collectionForApp,normalizeAppCollectionRules,normalizeCollectionMode,permitsVisibleContent} from '../src/app-collection';
import {defaultConfig,updateConfig,normalizeChromeOrigins} from '../src/config';
const off={duration:false,screenshots:false,structured:false};
describe('independent collection policy',()=>{
 it('defaults to duration only and matches exact per-app overrides',()=>{
  const config={...defaultConfig(),appCollectionRules:{'dev.private':off,'dev.screen':{...off,screenshots:true}}};
  expect(collectionForApp('dev.normal',config)).toEqual({...off,duration:true});
  expect(collectionForApp('dev.screen',config)).toEqual({...off,screenshots:true});
  expect(collectionForApp('dev.private',config)).toEqual(off);
  expect(collectionForApp('dev.private.other',config)).toEqual({...off,duration:true});
 });
 it('fails closed for unknown foregrounds and unknown visible windows under every policy',()=>{
  const config={...defaultConfig(),defaultCollection:{duration:true,screenshots:true,structured:true}};
  expect(collectionForApp(undefined,config)).toEqual(off);expect(collectionForApp('dev.mote.unknown-foreground',config)).toEqual(off);
  expect(permitsVisibleContent([],true,config)).toBe(false);
  expect(permitsVisibleContent(['dev.app'],false,config)).toBe(true);
  expect(permitsVisibleContent(['dev.app','dev.private'],false,{...config,appCollectionRules:{'dev.private':{duration:true,screenshots:false,structured:true}}})).toBe(false);
 });
 it('rejects legacy modes, missing/extra keys and malformed per-app grants',()=>{
  for(const value of ['content','activity','off',{}, {...off,duration:'true'}, {...off,content:true}])expect(()=>normalizeCollectionMode(value)).toThrow();
  for(const rules of [[],{'dev.app':'content'},{'':off},JSON.parse('{"__proto__":{"duration":true,"screenshots":true,"structured":true}}')])expect(()=>normalizeAppCollectionRules(rules)).toThrow();
  expect(()=>updateConfig(defaultConfig(),{...defaultConfig(),uiPageMode:'page_only'} as never)).toThrow();
  for(const key of ['defaultCollection','appCollectionRules','chromeOrigins'])expect(()=>updateConfig(defaultConfig(),{...defaultConfig(),[key]:null} as never)).toThrow();
 });
 it('normalizes only exact bounded HTTP(S) Chrome origins',()=>{
  expect(normalizeChromeOrigins(['https://EXAMPLE.test:443/','https://example.test'])).toEqual(['https://example.test']);
  for(const value of [['https://*.test'],['https://user@example.test'],['https://example.test/path'],['https://example.test?q=a'],['file:///tmp'],[' https://example.test'],Array(101).fill('https://example.test')])expect(()=>normalizeChromeOrigins(value)).toThrow();
 });
});
