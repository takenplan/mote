import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {writeFileSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {noteCapture} from '@mote/shared';
import {identityHash} from '../../src/scope/originals.js';
import {navigationRef} from '../../src/context-navigation.js';
import {memoryFixture,memoryText} from '../fixtures/mcp-memory.js';
import {call,value,source,item} from '../fixtures/mcp.js';
import {waitForState} from '../fixtures/scoped-query-accounts.js';

const note=(id:string,text:string)=>noteCapture({id,deviceId:'same-device',deviceName:'Generated device',platform:'import',capturedAt:'2026-10-16T12:00:00Z',text});

const okCall=async(client:Parameters<typeof call>[0],name:string,args:Record<string,unknown>={})=>{const result=await call(client,name,args);assert.equal(result.isError,undefined,JSON.stringify(result));return value(result);};

const captureMaterial=async(f:Awaited<ReturnType<typeof memoryFixture>>,user:{token:string},id:string)=>{const end=Date.now()+8000;for(;;){const page=await f.ok(user.token,'/api/materials'),material=page.items.find((item:any)=>item.origin.externalId===id);if(material)return material;assert.ok(Date.now()<end,'real capture organizer did not publish its ordinary Material');await delay(10);}};

export {note,okCall,captureMaterial};
