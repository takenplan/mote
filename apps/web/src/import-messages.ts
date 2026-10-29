import {moteText} from '@mote/shared/i18n';
/** Host-authored fallbacks only. Model/provider prose and captured text stay literal. */
const messages:Readonly<Record<string,string>>={
 'This import was requested for manual preview.':'确认这份资料的理解方式',
 'The parser did not provide a confidence and ambiguity assessment.':'解析未说明置信度与歧义，请核对预览。',
 'The parser reported low confidence or ambiguity.':'解析置信度不足或仍有歧义，请核对预览。',
 'The parser did not explain its high-confidence assessment.':'解析未说明高置信度的依据，请核对预览。',
 'Processing reported warnings; review the preview before publishing.':'处理产生了提醒，请核对预览后再保存。',
 'The parser did not account for every original file.':'尚未核对全部原件，请检查文件解析情况。',
 'Some originals were not parsed as evidence.':'部分原件未作为证据解析，请核对原件与预览。',
 'The parsed records passed host validation with high confidence and no ambiguity.':'解析记录已通过校验，置信度高且无歧义。',
 'The analysis did not provide a per-file disposition list. Unlisted files must not be assumed to have been parsed.':'缺少逐文件解析情况；未列出的原件不能视为已解析。',
};
export const isHostImportMessage=(value:string)=>Object.hasOwn(messages,value);
export const importMessage=(value:string)=>isHostImportMessage(value)?moteText(messages[value]):value;
