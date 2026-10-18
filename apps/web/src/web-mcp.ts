import type {ConfigServiceView} from '@mote/shared';

export type WebMcpConnection={id:string;enabled?:boolean;url:string;token?:string|boolean;sourceIds:string[]};
export function webMcpConnections(view:ConfigServiceView):WebMcpConnection[]{
 return (view.domains.find(domain=>domain.id==='mcpConnections')?.saved as {connections:WebMcpConnection[]}|undefined)?.connections??[];
}
