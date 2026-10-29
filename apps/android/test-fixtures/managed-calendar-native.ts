import {fixture,owner,command} from '../../server/test/fixtures/managed-calendar.js';

// Generated Central only. Native writes are made by the actual Android app on
// the explicitly selected disposable emulator, never by this host process.
let close:(()=>Promise<void>)|undefined,host:Awaited<ReturnType<typeof fixture>>,blocked=false;
host=await fixture({after:((callback:()=>Promise<void>)=>{close=callback;}) as any},{skipDeviceConnect:true,beforeListen:node=>{
 node.app.addHook('onRequest',async(request,reply)=>{if(blocked&&request.url.startsWith('/api/managed-calendar/')&&request.url.endsWith('/receipt'))return reply.code(503).send({error:'generated_offline_receipt'});});
 node.app.get('/fixture/pair',async()=>({token:host.paired.token,deviceId:'generated-device'}));
 node.app.post('/fixture/grant',async request=>host.grant(true,true,(request.body as {calendarId:string}).calendarId));
 node.app.post('/fixture/add',async()=>host.add());
 node.app.post('/fixture/change',async request=>{const body=request.body as {id:string;kind:'calendar.update'|'calendar.cancel'|'calendar.complete'};return host.change(node.actions.get(body.id),body.kind);});
 node.app.post('/fixture/receipts',async request=>{blocked=(request.body as {blocked:boolean}).blocked;return {blocked};});
 node.app.post('/fixture/revoke',async request=>{const inventory=await host.request('/api/action-capabilities'),grant=inventory.grants.find((value:any)=>value.id===(request.body as {id:string}).id)!;return host.request('/api/action-capability-grants/'+grant.id+'/revoke',command(grant.revision));});
 node.app.get('/fixture/action/:id',async request=>node.actions.get((request.params as {id:string}).id));
 node.app.get('/fixture/delivery/:id',async request=>{const queue=await host.request('/api/managed-calendar-deliveries',undefined,host.paired.token);return queue.items.find((value:any)=>value.id===(request.params as {id:string}).id)??{};});
}});
console.log(JSON.stringify({generatedOnly:true,origin:host.origin,ownerToken:owner}));
let closing=false;
const stop=async()=>{if(closing)return;closing=true;await close?.();process.exit(0);};
process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
