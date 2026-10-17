import type {FileProcessor,ProcessorInput} from '../file-processors.js';
import {ConnectorError} from './types.js';
import {dingtalkTranscript} from './dingtalk-recordings.js';
import {feishuTranscript} from './recording-formats.js';
import {gmailOriginalProcessor} from './gmail-adapter.js';
async function recordingBytes(input:ProcessorInput,provider:string){
 const item=input.sourceItem,metadata=item?.document?.originalMetadata;if(!item||metadata?.provider!==provider||typeof metadata.recordingId!=='string'||item.externalId!==metadata.recordingId+':export'||input.file.sizeBytes>16*1024*1024)throw new ConnectorError('recording_original_identity_invalid',409);
 const parts:Buffer[]=[];let size=0;for await(const part of input.readOriginal()){input.signal.throwIfAborted();size+=part.length;if(size>input.file.sizeBytes)throw new ConnectorError('recording_original_invalid',409);parts.push(part);}if(size!==input.file.sizeBytes)throw new ConnectorError('recording_original_invalid',409);return {text:Buffer.concat(parts).toString('utf8'),metadata,durationMs:typeof metadata.durationMs==='number'?metadata.durationMs:0};
}
const recording=(provider:'feishu'|'dingtalk'):FileProcessor=>({id:'connector.'+provider+'-transcript',version:'1',name:provider+' original transcript',stage:'extract',mediaTypes:[provider==='dingtalk'?'application/json':'text/plain'],localOnly:true,dependencies:{settings:[],parameters:[]},async process(input){const {text,metadata,durationMs}=await recordingBytes(input,provider);if(provider==='feishu')return feishuTranscript(text,durationMs);const raw=JSON.parse(text);if(raw.taskUuid!==metadata.recordingId)throw new ConnectorError('recording_original_identity_invalid',409);return dingtalkTranscript(raw,durationMs).transcript??{durationMs,segments:[],coverage:'full'};}});
export const connectorOriginalProcessors=[gmailOriginalProcessor,recording('feishu'),recording('dingtalk')];
