/** Chrome launches this bounded relay. It has no collector or Central API surface. */
import {connect} from 'node:net';
import {lstat,readFile} from 'node:fs/promises';
import {dirname,isAbsolute} from 'node:path';
import {CHROME_EXTENSION_ID,CHROME_MESSAGE_LIMIT} from './chrome-constants';
export async function readBridgeDescriptor(path:string):Promise<{socket:string;capability:string}> {
  if(!isAbsolute(path))throw Error('Invalid bridge descriptor');
  for(const target of [dirname(path),path]){const s=await lstat(target);if(s.isSymbolicLink()||s.uid!==process.getuid?.()||(s.mode&0o077)!==0)throw Error('Untrusted bridge ownership');}
  const stat=await lstat(path);if(!stat.isFile()||stat.size>4096)throw Error('Invalid descriptor size');
  const d=JSON.parse(await readFile(path,'utf8'));
  if(!d||typeof d.socket!=='string'||d.socket.length>100||!isAbsolute(d.socket)||typeof d.capability!=='string'||!/^[a-f0-9]{64}$/.test(d.capability))throw Error('Invalid bridge descriptor');
  const parent=await lstat(dirname(d.socket));const socket=await lstat(d.socket);
  if(!parent.isDirectory()||parent.uid!==process.getuid?.()||(parent.mode&0o077)!==0||!socket.isSocket()||socket.uid!==process.getuid?.())throw Error('Untrusted bridge socket');return {socket:d.socket,capability:d.capability};
}
export async function runChromeNativeHost(descriptorPath:string,input:NodeJS.ReadableStream=process.stdin,output:NodeJS.WritableStream=process.stdout):Promise<void>{
  const d=await readBridgeDescriptor(descriptorPath),socket=connect(d.socket);let native=Buffer.alloc(0),line=Buffer.alloc(0),closed=false;
  const close=()=>{if(closed)return;closed=true;clearTimeout(idle);socket.destroy();input.pause();};
  const idle=setTimeout(close,30000);idle.unref();
  socket.on('connect',()=>socket.write(JSON.stringify({type:'hello',capability:d.capability})+'\n'));
  socket.on('error',close);socket.on('close',close);input.on('end',close);input.on('error',close);
  input.on('data',(chunk:Buffer)=>{native=Buffer.concat([native,chunk]);while(native.length>=4){const size=native.readUInt32LE(0);if(size<2||size>CHROME_MESSAGE_LIMIT){close();return;}if(native.length<size+4)break;const body=native.subarray(4,size+4);native=native.subarray(size+4);try{JSON.parse(body.toString('utf8'));}catch{close();return;}socket.write(body);socket.write('\n');}if(native.length>CHROME_MESSAGE_LIMIT+4)close();});
  socket.on('data',(chunk:Buffer)=>{idle.refresh();line=Buffer.concat([line,chunk]);if(line.length>CHROME_MESSAGE_LIMIT+1){close();return;}let end:number;while((end=line.indexOf(10))>=0){const body=line.subarray(0,end);line=line.subarray(end+1);if(!body.length)continue;try{JSON.parse(body.toString('utf8'));}catch{close();return;}const header=Buffer.alloc(4);header.writeUInt32LE(body.length);output.write(header);output.write(body);}});
  await new Promise<void>(resolve=>socket.once('close',resolve));
}
if(require.main===module){const origin=`chrome-extension://${CHROME_EXTENSION_ID}/`;if(!process.argv.includes(origin)||!process.env.MOTE_CHROME_BRIDGE_DESCRIPTOR)process.exitCode=1;else runChromeNativeHost(process.env.MOTE_CHROME_BRIDGE_DESCRIPTOR).catch(()=>{process.exitCode=1;});}
