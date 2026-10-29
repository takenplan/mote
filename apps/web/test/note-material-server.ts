import {join} from 'node:path';
import {existsSync,rmSync,writeFileSync} from 'node:fs';
import {noteMaterialFixture} from './note-material-fixture';
const directory=process.argv[2],webRoot=process.argv[3];if(!directory||!webRoot)throw Error('Private directory and built Web required');
let short:Awaited<ReturnType<typeof noteMaterialFixture>>['short']|undefined;
const node=await noteMaterialFixture(directory,webRoot,runtime=>runtime.app.addHook('onRequest',async()=>{
 const flag=join(directory,'publish-generated-head');if(short&&existsSync(flag)){rmSync(flag);const old=short.material;runtime.materials.publish({id:old.id,kind:old.kind,schemaVersion:old.schemaVersion,title:'Generated new head',origin:old.origin,members:[{id:short.id,kind:'capture',ref:'capture:'+short.id}],blocks:[{id:'record',kind:'text',format:'plain',text:'NEW GENERATED HEAD; HISTORICAL BODY MUST STAY OLD.',memberIds:[short.id]}],coverage:{state:'complete'},fidelity:{state:'derived'},retention:{original:'retained',policy:'keep'}},{expectedRevision:old.revision});}
}));
short=node.short;await node.app.listen({host:'127.0.0.1',port:0});
console.log(JSON.stringify({server:node.app.server.address(),token:node.token,short:node.short,shared:node.shared,long:node.long,paged:node.paged,literal:node.literal,quoted:node.quoted,generatedOnly:true}));
process.on('SIGTERM',()=>{void node.app.close().then(()=>{writeFileSync(join(directory,'model-calls.json'),JSON.stringify({modelCalls:node.modelCalls()}));process.exit(node.modelCalls()?1:0);});});
