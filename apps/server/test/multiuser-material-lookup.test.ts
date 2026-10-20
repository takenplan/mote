import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {installPrivateData} from '../src/scope/private-data-schema.js';
import {PrivateData} from '../src/scope/private-data.js';
import {PrivateSql,PrivateCursor} from '../src/scope/private-data-sql.js';

const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const material=(name:string)=>'mat_'+digest(name),revision=(name:string)=>digest('revision:'+name),at='2026-10-20T00:00:00.000Z';
function fixture(t:TestContext){
 const db=new DatabaseSync(':memory:'),key=installPrivateData(db);t.after(()=>db.close());let artifactInspections=0;
 // Count the actual query's artifact-key inspections, rather than imposing a
 // timing threshold. These generated scalar paths keep json_extract semantics.
 db.function('json_extract',{deterministic:true},(raw:any,path:any)=>{let value=JSON.parse(String(raw));if(path==='$.key')artifactInspections++;for(const part of String(path).slice(2).split('.'))value=value?.[part];return value&&typeof value==='object'?JSON.stringify(value):value??null;});
 const a=new PrivateData(new PrivateSql(db,'generated-a',()=>{}),new PrivateCursor(key,'generated-deployment','generated-a'));
 for(const user of ['generated-a','generated-b'])db.prepare('INSERT INTO pd_sources VALUES(?,?,?,?,?)').run(user,'generated-source',JSON.stringify({id:'generated-source',enabled:true}),at,at);
 const add=(name:string,options:{user?:string;kind?:string;filtered?:boolean;hidden?:boolean;head?:number;versions?:number;members?:{name:string;version?:number}[]}={})=>{
  const user=options.user??'generated-a',id=material(name),head=options.head??1;
  db.exec('BEGIN');try{db.prepare('INSERT INTO pd_materials VALUES(?,?,?,?,?,?,?,?,?)').run(user,id,'generated-source',name,revision(name+head),head,at,at,options.hidden?head+1:1);
   for(let sequence=1;sequence<=(options.versions??head);sequence++){const members=sequence===1?options.members??[]:[],draft={id,kind:options.kind??'generated.file',schemaVersion:1,title:'Generated material',origin:{sourceId:'generated-source',externalId:name},members:members.map((member,index)=>({id:'input-'+index,kind:'material',ref:'material:'+material(member.name)+'@'+revision(member.name+(member.version??1))})),blocks:[{id:'body',kind:'text',format:'plain',text:'Generated retained body.',memberIds:members.map((_,index)=>'input-'+index)}],artifacts:[{key:options.filtered&&sequence===head?'coding-dialogue':'extraction',state:'ready',revision:'1'}],coverage:{state:'complete'},fidelity:{state:'lossless'},retention:{original:'retained',policy:'keep'}};db.prepare('INSERT INTO pd_material_versions VALUES(?,?,?,?,?,?,?)').run(user,id,revision(name+sequence),sequence,JSON.stringify(draft),'Generated retained body.',at);for(const [index,member]of members.entries())db.prepare('INSERT INTO pd_material_inputs VALUES(?,?,?,?,?,?)').run(user,id,revision(name+sequence),'input-'+index,material(member.name),revision(member.name+(member.version??1)));}
   db.exec('COMMIT');return id;
  }catch(error){db.exec('ROLLBACK');throw error;}
 };
 return {db,a,add,inspections:()=>artifactInspections,reset:()=>{artifactInspections=0;},retired:(name:string,user='generated-a')=>db.prepare('SELECT epoch FROM pd_material_retirements WHERE user_id=? AND material_id=?').get(user,material(name))?.epoch};
}

test('exact Material reads inspect only their input versions while unrelated account/history grows',t=>{
 const f=fixture(t),id=f.add('target');f.reset();assert.equal(f.a.material(id).id,id);const baseline=f.inspections();assert.equal(baseline,1);
 for(let index=0;index<64;index++)for(const user of ['generated-a','generated-b'])f.add('unrelated-'+index,{user,versions:3});
 f.reset();assert.equal(f.a.material(id).id,id);assert.equal(f.inspections(),baseline,'unrelated retained version JSON must not be parsed during this exact lookup');
});

test('targeted Coding withdrawal traverses hidden historical inputs without crossing the owner',t=>{
 const f=fixture(t);for(const user of ['generated-a','generated-b'])f.add('coding',{user,kind:'mote.coding-session'});
 f.add('middle',{head:2,hidden:true,members:[{name:'coding'}]});const target=f.add('target',{members:[{name:'middle',version:1}]});
 f.a.material(target);assert.equal(f.retired('coding'),1,'the hidden old intermediate cannot prune its current Coding ancestor');assert.equal(f.retired('coding','generated-b'),undefined);assert.equal(f.db.prepare('SELECT text FROM pd_material_versions WHERE user_id=? AND material_id=? AND revision=?').get('generated-a',material('coding'),revision('coding1'))!.text,'Generated retained body.');
});

test('an old input revision cannot retire its safely filtered current Coding head',t=>{
 const f=fixture(t),coding=f.add('coding',{head:2,kind:'mote.coding-session',filtered:true}),target=f.add('target',{members:[{name:'coding',version:1}]});
 assert.equal(f.a.material(target).id,target);assert.equal(f.a.material(coding).id,coding);assert.equal(f.retired('coding'),undefined);
});

test('diamond inputs retire each Coding root once and still hide current dependent heads',t=>{
 const f=fixture(t);f.add('coding',{kind:'mote.coding-session'});f.add('left',{members:[{name:'coding'}]});f.add('right',{members:[{name:'coding'}]});const target=f.add('target',{members:[{name:'left'},{name:'right'}]});
 assert.throws(()=>f.a.material(target),/not_found/);assert.equal(f.retired('coding'),1);assert.throws(()=>f.a.material(material('left')),/not_found/);assert.throws(()=>f.a.material(material('right')),/not_found/);assert.equal(f.retired('coding'),1,'already hidden roots must not be retired a second time');
});
