import {expect,it} from 'vitest';
import {requireSourceRegistration,SourcePausedFailure} from '../src/ingress-outcome';
const source={id:'generated-source',deviceId:'generated-device',kind:'mote.desktop',platform:'macos',name:'Generated',retention:'archive',enabled:true};
it('distinguishes validated pause from active registration without changing source settings',()=>{
 expect(()=>requireSourceRegistration(source,source,true)).not.toThrow();
 expect(()=>requireSourceRegistration({...source,enabled:false},source,true)).toThrow(SourcePausedFailure);
 expect(()=>requireSourceRegistration({...source,name:'Renamed',retention:'snapshot'},source,true)).not.toThrow();
});
it.each([{id:'other'},{deviceId:'other'},{kind:'other'},{platform:'other'},{enabled:undefined},{name:null},{retention:'other'}])('rejects malformed or wrong-source registration %j',patch=>{
 expect(()=>requireSourceRegistration({...source,...patch},source,true)).toThrow('中央来源注册确认无效');
});
