import {useEffect,useRef} from 'react';
import {moteText} from '@mote/shared/i18n';
import {containDialogFocus} from './dialog-focus';
export function SourceDisconnectReview({busy,cancel,confirm}:{busy:boolean;cancel:()=>void;confirm:()=>void}){
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>panel.current?containDialogFocus(panel.current,document.activeElement as HTMLElement|null):undefined,[]);
 return <div className="modal-backdrop connector-dialog-backdrop" onKeyDown={event=>{if(event.key==='Escape'&&!busy)cancel();}}><section ref={panel} className="modal connector-dialog" role="dialog" aria-modal="true" aria-label={moteText('断开连接')}><h2>{moteText('断开连接')}</h2><p>{moteText('断开后停止读取，已归档资料保留。')}</p><footer><button className="button" disabled={busy} onClick={cancel}>{moteText('取消')}</button><button className="button" disabled={busy} onClick={confirm}>{moteText('确认断开')}</button></footer></section></div>;
}
