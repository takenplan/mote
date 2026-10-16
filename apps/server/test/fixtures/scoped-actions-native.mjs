import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const {CalendarActions}=await import(pathToFileURL(process.env.GENERATED_NATIVE_ENTRY).href);
const root=process.env.GENERATED_ACTION_ROOT,owner=process.env.GENERATED_ACTION_OWNER,mode=process.env.GENERATED_ACTION_PHASE;
const ledger=join(root,'ledger-'+owner),external=join(root,'calendar-'+owner+'.json');await mkdir(ledger,{recursive:true,mode:0o700});
const io={
 async request(path,body){if(mode==='issued'&&path.endsWith('/receipt')){console.log(JSON.stringify({phase:'ack-ready'}));await new Promise(()=>{setInterval(()=>{},1000);});}
  const response=await fetch(process.env.GENERATED_ACTION_URL+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+process.env.GENERATED_ACTION_TOKEN,'x-mote-protocol-version':'2','x-mote-ingress-version':'3',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;
 },
 async read(key){try{return await readFile(join(ledger,key),'utf8');}catch(error){if(error.code==='ENOENT')return;throw error;}},
 async write(key,value){await writeFile(join(ledger,key),value,{mode:0o600,flush:true});},
 async native(command,input){if(command==='calendar-permission')return {permission:'granted',calendars:[{id:'same-calendar',title:'Generated existing '+owner,writable:true}]};assert.equal(command,'calendar-create');let saved;try{saved=JSON.parse(await readFile(external,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;saved={mutations:0,events:{}};}
  if(saved.events[input.id])return {externalId:saved.events[input.id].id};
  assert.equal(input.createAllowed,true,'a prior unknown claim may only reconcile its exact marker');saved.mutations++;const event={id:'generated-native-'+owner,calendarId:input.calendarId,title:input.title,description:input.description};saved.events[input.id]=event;await writeFile(external,JSON.stringify(saved),{mode:0o600,flush:true});return {externalId:event.id};
 },
};
const adapter=new CalendarActions({deviceId:'same-device',deviceName:'Generated '+owner},io);
if(mode!=='recover')await adapter.connect();await adapter.execute(process.env.GENERATED_ACTION_ID);console.log(JSON.stringify({phase:'completed'}));
