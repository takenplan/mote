import {useEffect,useRef,type ReactNode} from 'react';
import {X} from 'lucide-react';
import {moteText} from '@mote/shared/i18n';
import {containDialogFocus} from './dialog-focus';

export function PluginModal({title,close,opener,children,busy}:{title:string;close:()=>void;opener:HTMLElement|null;children:ReactNode;busy:boolean}){
 const ref=useRef<HTMLElement>(null);
 useEffect(()=>ref.current?containDialogFocus(ref.current,opener):undefined,[opener]);
 return <div className="modal-backdrop plugin-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)close();}} onKeyDown={event=>{if(event.key==='Escape'&&!busy){event.stopPropagation();close();}}}>
  <section className="modal plugin-modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
   <div className="section-heading"><h2>{title}</h2><button className="icon-button" aria-label={moteText('关闭详情')} disabled={busy} onClick={close}><X size={20}/></button></div>
   {children}
  </section>
 </div>;
}
