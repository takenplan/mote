/** Shared real host fixture for cross-await query regressions; no MCP server substitute. */
import type {TestContext} from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {buildApp} from '../../src/app.js';
import type {PluginReleaseTransport} from '../../src/plugin-release.js';

import {source,item,queryHttp,queryAccounts} from './scoped-query-accounts.js';
export {password,protocol,source,item,deferred} from './scoped-query-accounts.js';
export async function fixture(t:TestContext,allowLocal=true,options:{pluginReleaseTransport?:PluginReleaseTransport}={}){
 const root=mkdtempSync(join(tmpdir(),'mote-m11-')),cleanup:Array<()=>void>=[];let node=await buildApp({dataDir:root},options);
 t.after(async()=>{for(const callback of cleanup)callback();await node.app.close();rmSync(root,{recursive:true,force:true});});
 const {request,ok}=queryHttp(()=>node),{admin,a,b}=await queryAccounts(node,ok);
 const put=async(token:string,text:string,id='same-item',sourceId='same-source')=>ok(token,'/api/ingress/sources/'+sourceId+'/items','POST',{batchId:'batch-'+id,items:[item(text,id)]});
 const restart=async()=>{await node.app.close();node=await buildApp({dataDir:root},options);};
 return {get node(){return node;},beforeClose:(callback:()=>void)=>cleanup.push(callback),root,a,b,admin,request,ok,put,restart};
}
