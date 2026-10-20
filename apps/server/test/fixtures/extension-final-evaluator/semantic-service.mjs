// Synthetic semantic replies only. All facts originate in evaluator-owned input records.
import {createServer} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {ROOT,assert,sha256,delay} from './http-runtime.mjs';

export class SemanticService {
  constructor(){this.bindings=new Map();this.ledger=[];this.hold=null;this.mode='normal';}
  bind(original, observation, transaction, expectedEnvelope) {
    const text=JSON.stringify(expectedEnvelope);
    assert.equal(sha256(text),original.hash,'source Original hash equals independently serialized submitted evidence');
    this.bindings.set(original.ref,{original,observation,transaction,text});
  }
  async start() {
    this.server=createServer(async(req,res)=>{
      try {
        if(req.url!=='/normalize'||req.method!=='POST'){res.statusCode=404;res.end();return;}
        let body='';for await(const chunk of req)body+=chunk;
        const input=JSON.parse(body),binding=this.bindings.get(input.originalRef);
        assert(binding,'semantic mock received an original that was never generated/admitted');
        assert.equal(input.text,binding.text,'semantic model receives the exact original UTF-8 bytes');
        assert.equal(input.sourceId,binding.original.sourceId,'semantic model receives matching source identity');
        const entry={at:new Date().toISOString(),originalRef:input.originalRef,sourceId:input.sourceId,inputText:input.text,inputSha256:sha256(input.text),mode:this.mode,reply:null};this.ledger.push(entry);
        if(this.hold&&this.hold.sourceId===input.sourceId&&!this.hold.claimed){
          const hold=this.hold;hold.claimed=true;hold.request=entry;hold.arrive(entry);
          req.once('close',()=>{entry.requestClosed=true;});
          await hold.released;
        }
        const transaction=binding.transaction;
        const observations=transaction?[{transactionId:transaction.transactionId,occurredOn:transaction.postedAt.slice(0,10),amountMinor:Math.abs(transaction.amountCents),currency:transaction.currency,kind:transaction.transactionType==='refund'?'refund':'payment',evidenceId:input.originalRef,...(transaction.refundOf?{refundOf:transaction.refundOf}:{})}]:[];
        const response={observations};
        entry.reply=response;res.setHeader('content-type','application/json');res.end(JSON.stringify(response));
      }catch(error){this.ledger.push({at:new Date().toISOString(),error:error.message});res.statusCode=422;res.end(JSON.stringify({error:'invalid_generated_semantic_input',message:error.message}));}
    });
    await new Promise(resolve=>this.server.listen(0,'127.0.0.1',resolve));
    this.url='http://127.0.0.1:'+this.server.address().port;return this;
  }
  module() {
    return `// R05 evaluator replacement: exact input extraction transport, no host effects.\nexport async function normalize(input,{signal}={}){signal?.throwIfAborted();const response=await fetch(${JSON.stringify(this.url+'/normalize')},{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal});if(!response.ok)throw new Error('synthetic semantic extraction rejected');return response.json();}\n`;
  }
  arm(sourceId) {
    let arrive,release;
    const arrived=new Promise(r=>arrive=r),released=new Promise(r=>release=r);
    this.hold={sourceId,arrive,release,arrived,released,claimed:false};return this.hold;
  }
  async waitHeld() {
    assert(this.hold);return Promise.race([this.hold.arrived,delay(15000,undefined,{ref:false}).then(()=>{throw new Error('semantic delay boundary not reached');})]);
  }
  release() {this.hold?.release();this.hold=null;}
  async close(runDir=ROOT) {
    this.release();this.server?.closeAllConnections();if(this.server)await new Promise(resolve=>this.server.close(resolve));
    await writeFile(join(runDir,'semantic-model-ledger.json'),JSON.stringify(this.ledger,null,2));
  }
}
