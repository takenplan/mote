import {sourceMetadataSchema,type SourceItemRecord} from '@mote/shared';
import {moteText} from '@mote/shared/i18n';
import {isWebConnection,type Api} from './api';
import {sourceItemCaptureId,requireWebSourceItemReceipt,type WebSourceItemReceipt} from './web-source-receipt';
/** The existing reference flow keeps metadata only; no URI is fetched. */
export async function saveWebReference(api:Api,title:string,uri:string){
 const sourceId='manual-references',deviceId='web-reference',name=moteText('外部文件引用');
 const source={id:sourceId,name,kind:'custom',deviceId,platform:'import',retention:'reference',enabled:true};
 const web=api.connection&&isWebConnection(api.connection)?api.connection:undefined;
 if(web)await api.request('/api/ingress/devices',{method:'POST',body:JSON.stringify({id:deviceId,name,platform:'import'})});
 await api.request(web?'/api/ingress/sources':'/api/sources',{method:'POST',body:JSON.stringify(source)});
 const {item:prior}=await api.request<{item:SourceItemRecord|null}>('/api/sources/'+sourceId+'/item?externalId='+encodeURIComponent(uri));
 const value={title,text:'',uri,kind:'file',layer:'reference',deleted:false,mimeType:undefined,modifiedAt:undefined},fields=Object.keys(value) as (keyof typeof value)[];
 const same=prior&&JSON.stringify(sourceMetadataSchema.optional().parse(prior.metadata))===JSON.stringify(sourceMetadataSchema.optional().parse(undefined))&&fields.every(key=>prior[key]===value[key]);
 const revision=same?prior.revision:crypto.randomUUID(),observedAt=web&&same?prior.observedAt:new Date().toISOString(),item={...value,externalId:uri,revision,observedAt};
 if(!web)return api.request('/api/sources/'+sourceId+'/items',{method:'PUT',body:JSON.stringify(item)});
 const batchId='reference:'+revision;
 const captureId=await sourceItemCaptureId(sourceId,item.externalId,revision);
 const receipt=await api.request<WebSourceItemReceipt>('/api/ingress/sources/'+sourceId+'/items',{method:'POST',body:JSON.stringify({batchId,items:[item]})});
 requireWebSourceItemReceipt(receipt,{...web,sourceId,batchId,captureId,externalId:item.externalId,revision},'Reference');
 return receipt;
}
