import {sourceItemSchema,type SourceItem,type SourceItemRecord} from '@mote/shared';
import type {ConnectorSources} from '../connectors/ports.js';
import {connectorHash} from './connector-vault.js';

function sourceItem(record:SourceItemRecord):SourceItem {
 const {captureId:_,sourceId:__,receivedAt:___,current:____,...item}=record;
 return sourceItemSchema.parse(item);
}
function semantic(item:SourceItem){const {observedAt:_,revision:__,...value}=item;return value;}

/** A recording has one owner-bound export head. Its canonical transcript keeps
 * all segment locators together; a correction replaces that head without
 * deleting retained originals or turning it into a privacy erasure. */
export class RecordingRevisions {
 constructor(private readonly sources:ConnectorSources,private readonly sourceId:string){}
 revision(input:SourceItem):SourceItem {
  const item=sourceItemSchema.parse(input),record=this.sources.getItem(this.sourceId,item.externalId),prior=record?sourceItem(record):undefined;
  const value=semantic(item);
  // Match the host's serialized semantic fingerprint, including every stable
  // SourceItem field. Observation time alone does not produce another version.
  item.revision=prior&&JSON.stringify(semantic(prior))===JSON.stringify(value)?prior.revision:connectorHash([value,prior?.revision??'']);
  return item;
 }
}
