import {useEffect,useRef,useState} from 'react';
import {Search,MessageSquare,ArrowRight} from 'lucide-react';
import {moteText} from '@mote/shared/i18n';
import {type Api,errorMessage} from './api';
import {useResource} from './useResource';
import {LibraryBrowseLayout} from './LibraryBrowse';
export function GlobalRetrieval({onPage}:{onPage:(page:string)=>void}) {
 const [mode,setMode]=useState<'search'|'ask'>('search'),[query,setQuery]=useState('');
 const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();input.current?.focus();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[]);
 return <form className="global-retrieval" role="search" aria-label={moteText('搜索与提问')} onSubmit={event=>{event.preventDefault();if(mode==='ask'){window.location.hash='/ask'+(query.trim()?'?questionDraft='+encodeURIComponent(query.trim()):'');return;}if(!query.trim())return;window.location.hash='/search?query='+encodeURIComponent(query.trim());}}>
 <div className="global-retrieval-modes"><button type="button" aria-pressed={mode==='search'} onClick={()=>setMode('search')}><Search size={15}/>{moteText('搜索')}</button><button type="button" aria-pressed={mode==='ask'} onClick={()=>setMode('ask')}><MessageSquare size={15}/>{moteText('提问')}</button></div>
 <input ref={input} aria-label={moteText('搜索资料')} placeholder={moteText(mode==='ask'?'向 Mote 提问':'搜索资料')} value={query} onChange={event=>setQuery(event.target.value)} maxLength={500}/><kbd>⌘ K</kbd><button type="submit" className="icon-button" aria-label={moteText(mode==='ask'?'提问':'搜索')}><ArrowRight size={16}/></button>
 </form>;
}
export function SearchWorkspace({api,onOpen}:{api:Api;onOpen:(ref:string)=>void}) {
 const read=()=>new URLSearchParams(window.location.hash.split('?')[1]??'').get('query')??'';
 const [query,setQuery]=useState(read),[cursor,setCursor]=useState<string>(),[selected,setSelected]=useState<string>();
 useEffect(()=>{const sync=()=>{setQuery(read());setCursor(undefined);setSelected(undefined);};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync);},[]);
 const page=useResource<{items:{ref:string;title:string;snippet?:string;kind:string}[];nextCursor:string|null}>(api,query?'/api/context/search?'+new URLSearchParams({query,limit:'30',...(cursor?{cursor}:{})}):null);
 return <section className="search-workspace"><div className="page-heading"><h1>{moteText('搜索资料')}</h1><span>{query}</span></div><LibraryBrowseLayout api={api} reference={selected} onClose={()=>setSelected(undefined)} onOpen={onOpen}><div className="panel-pad">{page.error!==undefined&&<p role="alert">{errorMessage(page.error)}<button className="button" onClick={page.refresh}>{moteText('重新读取')}</button></p>}{page.loading&&!page.data&&<p role="status">{moteText('正在读取…')}</p>}{page.data?.items.map(item=><button className="library-record" key={item.ref} onClick={()=>setSelected(item.ref)}><span className="library-record-copy"><strong>{item.title}</strong><small>{item.snippet}</small></span></button>)}{page.data&&!page.data.items.length&&<p>{moteText('没有匹配的资料')}</p>}{(cursor||page.data?.nextCursor)&&<div className="filter-bar">{cursor&&<button className="button" onClick={()=>setCursor(undefined)}>{moteText('返回第一页')}</button>}{page.data?.nextCursor&&<button className="button" onClick={()=>setCursor(page.data!.nextCursor!)}>{moteText('下一页')}</button>}</div>}</div></LibraryBrowseLayout></section>;
}
