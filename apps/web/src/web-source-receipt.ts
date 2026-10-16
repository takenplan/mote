import {uploadHash} from './upload-part';

/** M02/M03 source-item identity, distinct from query-visible capture references. */
export async function sourceItemCaptureId(sourceId:string,externalId:string,revision:string){
 const hash=await uploadHash(new TextEncoder().encode(JSON.stringify([sourceId,externalId,revision])).buffer as ArrayBuffer);
 return `${hash.slice(0,8)}-${hash.slice(8,12)}-5${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
}
export type WebSourceItemReceipt={version:number;state:string;deploymentId:string;userId:string;sourceId:string;batchId:string;captures:{id:string;sourceId:string;externalId:string;revision:string;duplicate:boolean;original?:{ref:string;sourceId:string;captureId:string;hash:string;bytes:number;mime:string;retention:string}}[]};
export function requireWebSourceItemReceipt(value:WebSourceItemReceipt,expected:{deploymentId:string;userId:string;sourceId:string;batchId:string;captureId:string;externalId:string;revision:string},label:string){
 const item=value?.captures?.[0];
 if(value?.version!==3||value.state!=='received'||value.deploymentId!==expected.deploymentId||value.userId!==expected.userId||value.sourceId!==expected.sourceId||value.batchId!==expected.batchId||value.captures?.length!==1||!item||item.id!==expected.captureId||item.sourceId!==expected.sourceId||item.externalId!==expected.externalId||item.revision!==expected.revision||typeof item.duplicate!=='boolean')throw Error(label+' acknowledgement does not match');
 return item;
}
