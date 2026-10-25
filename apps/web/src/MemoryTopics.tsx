import {moteText} from '@mote/shared/i18n';
import {type Api,errorMessage} from './api';
import {useResource} from './useResource';
export interface ContextTree {id:string;version:string;label:string;nodes:{id:string;label:string;parentId?:string}[]}
export function MemoryTopics({api,treeId,nodeId,onChange}:{api:Api;treeId:string;nodeId:string;onChange:(treeId:string,nodeId:string)=>void}){
 const trees=useResource<{items:ContextTree[]}>(api,'/api/context-trees');
 const tree=trees.data?.items.find(item=>item.id===treeId)??trees.data?.items[0];
 return <section className="memory-topic-browser" aria-label={moteText('记忆主题')}>
 <div className="memory-dimension"><label>{moteText('浏览维度')}<select aria-label={moteText('浏览维度')} value={tree?.id??treeId} onChange={event=>onChange(event.target.value,'')}>{!trees.data&&<option value="topics">{moteText('主题')}</option>}{trees.data?.items.map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select></label></div>
 {trees.error!==undefined&&<p role="alert">{errorMessage(trees.error)}<button className="text-button" onClick={trees.refresh}>{moteText('重新读取')}</button></p>}
 {tree&&<nav className="memory-topic-nodes" aria-label={tree.label}><button className={!nodeId?'active':''} aria-current={!nodeId?'page':undefined} onClick={()=>onChange(tree.id,'')}>{moteText('全部记忆')}</button>{tree.nodes.map(node=><button key={node.id} className={(nodeId===node.id?'active ':'')+(node.parentId?'child':'')} aria-current={nodeId===node.id?'page':undefined} onClick={()=>onChange(tree.id,node.id)}>{node.label}</button>)}</nav>}
 </section>;
}
