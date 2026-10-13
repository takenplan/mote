import type {Capture} from './api';
/** Presentation only: retain child identity, coordinates, attribution and flags.
 * Paging is joined before grouping; a later page can extend the last group. */
export function dialogueGroups(chunks:Capture[]){
 const groups:Capture[][]=[];
 for(const chunk of chunks){
  const prior=groups.at(-1)?.at(-1),a=prior?.fileEvidence,b=chunk.fileEvidence;
  if(prior&&a&&b&&a.artifactId===b.artifactId&&a.speaker&&a.speaker!=='SPEAKER_UNKNOWN'&&a.speaker===b.speaker&&Boolean(a.overlap)===Boolean(b.overlap)&&a.speakerAttribution?.confirmationId===b.speakerAttribution?.confirmationId&&a.endMs!==undefined&&b.startMs!==undefined&&b.startMs>=a.startMs!&&b.startMs-a.endMs<=1200)groups.at(-1)!.push(chunk);
  else groups.push([chunk]);
 }
 return groups;
}
