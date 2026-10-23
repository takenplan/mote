import type {ConfigDomainView} from '@mote/shared';
/** A saved algorithm default does not imply an admitted background policy. */
export function automationChecked(domain:ConfigDomainView,path:string,draft:boolean,saved:boolean,intent:readonly string[]){
 if(intent.includes(path)||draft!==saved)return draft;
 return domain.automation?.find(item=>item.path===path)?.enabled??draft;
}
export function automationToggle(intent:readonly string[],path:string,enabled:boolean){return enabled?[...new Set([...intent,path])]:intent.filter(item=>item!==path);}
export function automationIntent(domain:string,paths:readonly string[]){return paths.map(path=>domain+':'+path);}
