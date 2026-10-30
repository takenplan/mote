import type {ImportJob} from '@mote/shared';
import {moteText} from '@mote/shared/i18n';
const missingAssessment='The parser did not provide a confidence and ambiguity assessment.';
const lowAssessment='The parser reported low confidence or ambiguity.';
const unexplainedAssessment='The parser did not explain its high-confidence assessment.';
const reportedWarnings='Processing reported warnings; review the preview before publishing.';
const missingOriginals='The parser did not account for every original file.';
const unparsedOriginals='Some originals were not parsed as evidence.';
const validated='The parsed records passed host validation with high confidence and no ambiguity.';
/** Public facts must prove the gate's host branch; an exact sentence alone is not provenance. */
function hostGateKey(job:ImportJob):string|undefined {
 const gate=job.reviewGate,decision=job.reviewDecision;if(!gate)return;
 // Low/ambiguous decisions may supply any literal reason, including every host fallback.
 if(decision&&(decision.confidence!=='high'||decision.ambiguous)&&decision.reason===gate.reason)return;
 // Manual processing is not public. Its sentence can also be a model-authored reason.
 if(gate.decision==='confirmation'){
  if(gate.reason===missingAssessment&&!decision)return '解析未说明置信度与歧义，请核对预览。';
  if(gate.reason===lowAssessment&&decision&&(decision.confidence!=='high'||decision.ambiguous)&&!decision.reason)return '解析置信度不足或仍有歧义，请核对预览。';
  if(decision?.confidence==='high'&&!decision.ambiguous){
   if(gate.reason===unexplainedAssessment&&!decision.reason)return '解析未说明高置信度的依据，请核对预览。';
   if(decision.reason){
    if(gate.reason===reportedWarnings&&job.warnings.length)return '处理产生了提醒，请核对预览后再保存。';
    if(gate.reason===missingOriginals&&(!job.dispositions||job.dispositions.items.length!==job.files.length))return '尚未核对全部原件，请检查文件解析情况。';
    if(gate.reason===unparsedOriginals&&job.dispositions&&job.dispositions.items.length===job.files.length&&(job.dispositions.counts.unsupported||job.dispositions.counts.excluded||(!job.dispositions.counts.parsed&&!job.dispositions.counts.processing)))return '部分原件未作为证据解析，请核对原件与预览。';
   }
  }
 }else if(gate.reason===validated&&decision?.confidence==='high'&&!decision.ambiguous&&decision.reason&&job.dispositions&&job.dispositions.items.length===job.files.length&&!job.dispositions.counts.unsupported&&!job.dispositions.counts.excluded&&(job.dispositions.counts.parsed||job.dispositions.counts.processing))return '解析记录已通过校验，置信度高且无歧义。';
}
export const importReviewMessage=(job:ImportJob)=>{const key=hostGateKey(job);return key?moteText(key):job.reviewGate?.reason;};
/** Warnings merge provider and worker prose without per-item provenance: preserve every byte. */
export const importHostDiagnostics=(job:ImportJob)=>hostGateKey(job)?[job.reviewGate!.reason]:[];
