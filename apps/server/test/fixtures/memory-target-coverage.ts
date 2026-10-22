import assert from 'node:assert/strict';

/** Synthetic model coverage accounts only for this call's host-selected targets. */
export function memoryTargetCoverageKeys(body:unknown):string[]{
 const request=body as {messages?:{content?:string|{type?:string;text?:string}[]}[]},content=request?.messages?.[0]?.content,text=typeof content==='string'?content:Array.isArray(content)?content[0]?.text:undefined;
 assert.ok(typeof text==='string','Generated model request must contain the current host envelope');
 const envelope=JSON.parse(text),members=envelope.untrustedTaskContext?.memoryWork?.members;
 if(members===undefined)return [];
 assert.ok(Array.isArray(members),'Generated Memory targets must be a member vector');
 return members.map((member:unknown)=>{const key=(member as {key?:unknown})?.key;assert.ok(typeof key==='string'&&key.length>0,'Generated Memory target must carry its exact host key');return key;});
}
