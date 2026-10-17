import {codingConversationEvidence,codingDialogueText,type SourceItem} from '@mote/shared';
/** Reassemble transport parts before recognizing a complete host envelope.
 * Legacy rows without speaker metadata remain explicitly unattributed. */
export function conversationRecords(items:SourceItem[]){
  const active=items.filter(item=>!item.deleted),events=new Map<string,SourceItem[]>();
  for(const item of active){const id=item.document!.coding!.eventId;const event=events.get(id)??[];event.push(item);events.set(id,event);}
  const admitted=new Map<string,SourceItem[]>();
  for(const [id,parts] of events){
    const ordered=[...parts].sort((a,b)=>a.document!.coding!.part-b.document!.coding!.part),coding=ordered[0]!.document!.coding!;
    const complete=ordered.length===coding.parts&&ordered.every((item,index)=>item.document!.coding!.part===index&&item.document!.coding!.parts===coding.parts);
    const original=ordered.map(item=>item.text).join(''),text=codingDialogueText(coding,original);
    if(complete&&text&&ordered.every(item=>codingConversationEvidence(item.document!.coding!))&&codingConversationEvidence(coding,text)){
      admitted.set(id,text===original?ordered:[{...ordered[0],text,document:{...ordered[0].document,coding:{...coding,part:0,parts:1}}}]);
    }
  }
  return [...admitted.values()].flat();
}
