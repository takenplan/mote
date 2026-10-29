import {moteText} from '@mote/shared/i18n';

/** Display existing time coordinates; a missing coordinate is never zero. */
export function recordingClock(ms:number|null|undefined):string {
 if(ms==null||!Number.isFinite(ms)||ms<0)return moteText('未标时间');
 const seconds=Math.floor(ms/1000),hours=Math.floor(seconds/3600);
 return (hours?hours+':':'')+String(Math.floor(seconds/60)%60).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
}
/** Only the actual diarization artifact makes SPEAKER_n an anonymous group.
 * Provider-supplied transcript labels remain literal source labels. */
export function recordingSpeaker(speaker:string|undefined,diarized:boolean,confirmedName?:string):string {
 if(confirmedName)return confirmedName;
 const match=diarized&&speaker?.match(/^SPEAKER_(\d+)$/),index=match?Number(match[1]):undefined;
 return index!==undefined&&Number.isSafeInteger(index)&&index>=0?moteText('说话人 {0}',index+1):speaker||moteText('未标记说话人');
}
export function installRecordingStyles(){
 if(document.querySelector('link[data-mote-recording-final]'))return;
 const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./recording-final.css',import.meta.url).href;link.dataset.moteRecordingFinal='';document.head.append(link);
}
