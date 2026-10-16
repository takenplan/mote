import type {ImportJob,ImportReviewDecision,ImportReviewGate} from '@mote/shared';
/** Existing host review gate, shared by legacy algorithm fixtures and M06. */
export function importReviewGate(job:Pick<ImportJob,'warnings'|'dispositions'|'files'>&{processing:'automatic'|'preview'},decision:ImportReviewDecision|undefined,informationalWarnings=false):ImportReviewGate {
 if(job.processing!=='automatic')return {decision:'confirmation',reason:'This import was requested for manual preview.'};
 if(!decision)return {decision:'confirmation',reason:'The parser did not provide a confidence and ambiguity assessment.'};
 if(decision.confidence!=='high'||decision.ambiguous)return {decision:'confirmation',reason:decision.reason??'The parser reported low confidence or ambiguity.'};
 if(!decision.reason)return {decision:'confirmation',reason:'The parser did not explain its high-confidence assessment.'};
 if(job.warnings.length&&!informationalWarnings)return {decision:'confirmation',reason:'Processing reported warnings; review the preview before publishing.'};
 if(!job.dispositions||job.dispositions.items.length!==job.files.length)return {decision:'confirmation',reason:'The parser did not account for every original file.'};
 if(job.dispositions.counts.unsupported||job.dispositions.counts.excluded||(!job.dispositions.counts.parsed&&!job.dispositions.counts.processing))return {decision:'confirmation',reason:'Some originals were not parsed as evidence.'};
 return {decision:'automatic',reason:'The parsed records passed host validation with high confidence and no ambiguity.'};
}
