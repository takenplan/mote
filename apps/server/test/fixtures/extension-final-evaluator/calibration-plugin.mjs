// Evaluator-owned adversarial calibration specimen; never the submitted finance extension.
import {createHash} from 'node:crypto';
const hash = value => createHash('sha256').update(value).digest('hex');
function draft(input, captureId, body) {
  return {id:'mat_'+hash(JSON.stringify([input.sourceId,input.identity])),kind:'r5.calibration',schemaVersion:1,title:'Independent evaluator calibration',
    origin:{sourceId:input.sourceId,externalId:input.identity},
    blocks:[{id:'body',kind:'text',format:'json',text:JSON.stringify(body),memberIds:['evidence']}],
    members:[{id:'evidence',kind:'capture',ref:'capture:'+captureId}],
    coverage:{state:'complete'},fidelity:{state:'derived'},retention:{original:'retained',policy:'keep'}};
}
export function createMotePlugin() {
  return {components:[
    {id:'r5.calibration.processor',version:'1',surface:'processing',capability:'processor',async invoke(input,host,signal){
      signal.throwIfAborted(); const result=await host.call('readOriginal',[input.originalRef]);
      const text=JSON.parse(Buffer.from(result.bytes.data).toString('utf8')).text;
      return host.call('stageExtraction',[input.originalRef,{durationMs:0,coverage:'full',engine:'r5-evaluator-calibration',segments:[{startMs:0,endMs:0,untimed:true,text}]}]);
    }},
    {id:'r5.calibration.source',version:'1',surface:'ingress',capability:'source',async invoke(input,host,signal){
      if(input.mode==='registry') return {success:true,netCents:83335,materialId:'plausible-only'};
      if(input.mode==='foreign') return host.call('readOriginal',[input.originalRef]);
      const page=await host.call('pageOriginals',[input.sourceId,'',7]);
      const original=page.items.find(item=>item.ref===input.originalRef)??page.items[0];
      if(input.mode==='hardcoded') return host.call('publishMaterial',[draft(input,original.captureId,{netCents:83335})]);
      const result=await host.call('readOriginal',[original.ref]);
      const text=JSON.parse(Buffer.from(result.bytes.data).toString('utf8')).text;
      if(input.mode==='late') {
        await fetch(input.control+'/held');
        let rejected=false;
        try{await host.call('publishMaterial',[draft(input,original.captureId,{text,late:true})]);}catch{rejected=true;}
        await fetch(input.control+'/observed',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({rejected,aborted:signal.aborted})});
        return {rejected};
      }
      signal.throwIfAborted();
      return host.call('publishMaterial',[draft(input,original.captureId,{text,originalRef:original.ref})]);
    }},
  ],async close(){}};
}
