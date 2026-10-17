import {sourceItemSchema,type SourceItem,type SourceItemRecord} from '@mote/shared';
import type {ConnectorSources} from '../connectors/ports.js';
import {connectorHash} from './connector-vault.js';

function sourceItem(record:SourceItemRecord):SourceItem {
 const {captureId:_,sourceId:__,receivedAt:___,current:____,...item}=record;
 return sourceItemSchema.parse(item);
}
function semantic(item:SourceItem){const {observedAt:_,revision:__,...value}=item;return value;}

/** Recording revisions use the existing owner-bound SourceItem lifecycle.
 * Empty current snapshots withdraw superseded speech without deleting retained
 * originals or turning an ordinary correction into a privacy erasure. */
export class RecordingRevisions {
 constructor(private readonly sources:ConnectorSources,private readonly sourceId:string,private readonly provider:string){}
 revision(input:SourceItem):SourceItem {
  const item=sourceItemSchema.parse(input),record=this.sources.getItem(this.sourceId,item.externalId),prior=record?sourceItem(record):undefined;
  const value=semantic(item);
  // Match the host's serialized semantic fingerprint, including every stable
  // SourceItem field. Observation time alone does not produce another version.
  item.revision=prior&&JSON.stringify(semantic(prior))===JSON.stringify(value)?prior.revision:connectorHash([value,prior?.revision??'']);
  return item;
 }
 async replaceSegments(recordingId:string,current:SourceItem[],original:SourceItem,authorize:()=>void,fence:()=>Promise<void>){
  authorize();const keep=new Set(current.map(item=>item.externalId)),withdrawn:SourceItem[]=[];let cursor:string|undefined;
  // Collect before publishing: replacing a head can move it across page cursors.
  do {
   authorize();const page=this.sources.listItems({sourceId:this.sourceId,limit:100,...(cursor?{cursor}:{})});
   for(const record of page.items){
    const metadata=record.document?.originalMetadata,index=metadata?.segment;
    if(record.deleted||record.kind!=='file'||record.layer!=='snapshot'||metadata?.provider!==this.provider||metadata.recordingId!==recordingId||typeof index!=='number'||!Number.isSafeInteger(index)||index<0||record.externalId!==recordingId+':segment:'+index||keep.has(record.externalId))continue;
    const prior=this.sources.getItem(this.sourceId,record.externalId);if(!prior)continue;
    const item=sourceItem(prior);
    withdrawn.push({...item,observedAt:original.observedAt,title:original.title,uri:original.uri,text:'',deleted:false,document:{...item.document,timeBasis:original.document?.timeBasis??'unknown',recordedAt:original.document?.recordedAt,originalMetadata:{...item.document?.originalMetadata,withdrawn:true}}});
   }
   cursor=page.nextCursor??undefined;
  }while(cursor);
  const items=[...withdrawn,...current];
  for(let offset=0;offset<items.length;offset+=500){
   await fence();authorize();
   await this.sources.upsertBatch(this.sourceId,items.slice(offset,offset+500).map(item=>this.revision(item)),authorize);
  }
 }
}
