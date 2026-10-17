import {expect,it} from 'vitest';
import {parseDesktopConnectionInvitation} from '../src/connection-invitation';

const now=Date.parse('2026-10-17T12:00:00Z');
const invitation={format:'mote.connection',version:2,deploymentId:'generated-deployment',userId:'generated-account',serverUrl:'https://central.example',purpose:'device',code:'a'.repeat(43),expiresAt:'2026-10-17T12:10:00.000Z'};
const encode=(value:unknown)=>JSON.stringify(value);
const uri=(value:unknown)=>'mote://connect?data='+Buffer.from(encode(value)).toString('base64url');
const parse=(input:unknown,time=now)=>parseDesktopConnectionInvitation(input,time);

it('accepts the producer v2 JSON and canonical URI with an immutable fixed device subject',()=>{
 for(const input of [encode(invitation),uri(invitation),' \n'+encode(invitation)+'\t ']){
  const value=parse(input);expect(value).toEqual(invitation);expect(Object.isFrozen(value)).toBe(true);
 }
 const bound={...invitation,deviceId:'generated-original.device:1'};
 expect(parse(uri(bound))).toEqual(bound);
});

it('keeps the subject exact without adding a device or normalizing a different origin',()=>{
 const value=parse(encode(invitation));expect(Object.keys(value)).toEqual(Object.keys(invitation));
 expect(value).not.toHaveProperty('deviceId');
 expect(parse(encode({...invitation,serverUrl:'http://127.0.0.1:47852'})).serverUrl).toBe('http://127.0.0.1:47852');
 expect(parse(encode({...invitation,serverUrl:'http://[::1]:47852'})).serverUrl).toBe('http://[::1]:47852');
});

it('rejects the retired owner invitation instead of accepting a v1 downgrade',()=>{
 const {deploymentId:_,userId:__,purpose:___,...legacy}=invitation;
 expect(()=>parse(encode({...legacy,version:1}))).toThrow();
});

it.each(Object.keys(invitation))('rejects a missing %s binding',key=>{
 const missing:Record<string,unknown>={...invitation};delete missing[key];
 expect(()=>parse(encode(missing))).toThrow();
});

it.each([
 {format:'other.connection'}, {version:1}, {version:3}, {purpose:'central'},
 {purpose:'owner'}, {deploymentId:''}, {userId:''}, {deploymentId:'d'.repeat(129)},
 {userId:'u'.repeat(129)}, {deploymentId:'generated\ninstance'}, {userId:'generated\u007faccount'},
 {deploymentId:12}, {userId:null}, {code:'a'.repeat(42)}, {code:'a'.repeat(44)},
 {code:'='.repeat(43)}, {code:'a'.repeat(42)+'\n'}, {deviceId:''}, {deviceId:null},
 {deviceId:'d'.repeat(129)}, {deviceId:'generated device'}, {deviceId:'../device'},
 {deviceId:'generated\n.device'}, {expiresAt:'2026-10-17T12:10:00+00:00'},
 {expiresAt:'2026-10-17T12:10:00.0000Z'}, {expiresAt:'2026-02-30T12:10:00.000Z'},
 {expiresAt:'2026-10-17T24:00:00.000Z'}, {expiresAt:now+60000},
 {serverUrl:'https://central.example/'}, {serverUrl:'https://CENTRAL.example'},
 {serverUrl:'https://central.example:443'}, {serverUrl:'https://central.example/path'},
 {serverUrl:'https://central.example?owner=a'}, {serverUrl:'https://central.example#pair'},
 {serverUrl:'https://user:secret@central.example'}, {serverUrl:'http://central.example'},
 {serverUrl:'https://central.example\\@other.example'}, {serverUrl:' https://central.example'},
 {ownerToken:'generated-owner-secret'}, {token:'generated-token'}, {extra:true},
])('rejects malformed or extended v2 fields: %j',change=>{
 expect(()=>parse(encode({...invitation,...change}))).toThrow();
});

it('checks real UTC dates and the deadline again at confirmation/restart',()=>{
 expect(parse(encode({...invitation,expiresAt:'2026-10-17T12:10:00Z'}))).toHaveProperty('expiresAt','2026-10-17T12:10:00Z');
 expect(parse(encode({...invitation,expiresAt:'2026-10-17T12:10:00.1Z'}))).toHaveProperty('expiresAt','2026-10-17T12:10:00.1Z');
 for(const time of [Date.parse(invitation.expiresAt),Date.parse(invitation.expiresAt)+1,NaN,Infinity])expect(()=>parse(encode(invitation),time)).toThrow();
});

it('rejects noncanonical links, invalid UTF-8 and permissive base64 decodings',()=>{
 const good=uri(invitation),encoded=good.split('=')[1]!;
 for(const input of [good+'&owner=other',good+'=',good+'#other',good.replace('connect','other'),good.replace('mote://','mote://owner@'),good.replace('?data=','?x='),'mote://connect?data=%'+encoded,'mote://connect?data=Zh','mote://connect?data='+Buffer.from([0xc0,0xaf]).toString('base64url')])expect(()=>parse(input)).toThrow();
});

it('enforces the shared 8 KiB UTF-8 limit before parsing input',()=>{
 const json=encode(invitation),exact=json+' '.repeat(8192-Buffer.byteLength(json));
 expect(parse(exact)).toEqual(invitation);expect(()=>parse(exact+' ')).toThrow();
 const multiByte=json+'\u3000'.repeat(3000);expect(multiByte.length).toBeLessThan(8192);expect(()=>parse(multiByte)).toThrow();
 for(const input of [null,undefined,{},[],12,true,'not JSON','[]','null'])expect(()=>parse(input)).toThrow();
});
