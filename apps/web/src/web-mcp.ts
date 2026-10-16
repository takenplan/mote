import type {ConfigServiceView} from '@mote/shared';
import type {Api} from './api';

export type WebMcpConnection={id:string;enabled?:boolean;url:string;token?:string|boolean;sourceIds:string[]};
export function webMcpConnections(view:ConfigServiceView):WebMcpConnection[]{
 return (view.domains.find(domain=>domain.id==='mcpConnections')?.saved as {connections:WebMcpConnection[]}|undefined)?.connections??[];
}
/** Explicit preparation persists the user's connection and its granted source.
 * Discovery/import subsequently select only these server-held identifiers. */
export async function prepareWebMcpConnection(api:Api,baseline:ConfigServiceView,input:{id:string;sourceId:string;name:string;url:string;token:string},signal?:AbortSignal){
 const deviceId='mcp-import';
 await api.request('/api/ingress/devices',{method:'POST',body:JSON.stringify({id:deviceId,name:input.name,platform:'import'}),signal});
 await api.request('/api/ingress/sources',{method:'POST',body:JSON.stringify({id:input.sourceId,name:input.name,kind:'mcp',deviceId,platform:'import',retention:'snapshot',enabled:true}),signal});
 return api.request<ConfigServiceView>('/api/configuration/mcpConnections',{method:'PUT',body:JSON.stringify({revision:baseline.revision,value:{connections:[...webMcpConnections(baseline),{id:input.id,url:input.url,token:input.token,sourceIds:[input.sourceId]}]},preserveRedactedSecrets:true}),signal});
}
