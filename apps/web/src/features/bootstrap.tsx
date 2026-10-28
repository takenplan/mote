import { moteText } from '@mote/shared/i18n';
import { builtinCollections } from './collections';
import { builtinPages } from './entries';
import { homeEntries } from './agent-view';
import { webFeatures } from './registry';
import { MemoryRecordPanel } from './memory-record';
import { sourceMaterialViews } from './source-material';
import { ownerQuestionPanels } from './owner-questions';

// Only the application entrypoint installs builtins. View and registry consumers
// can be imported without starting feature installation.
export const featuresReady=(async()=>{
  for(const id of new Set([...builtinPages,...builtinCollections,...homeEntries].map(page=>page.featureId)))await webFeatures.install({id,version:'1',components:[]},[...builtinPages.filter(page=>page.featureId===id).map(entry=>({surface:'page' as const,entry})),...builtinCollections.filter(page=>page.featureId===id).map(entry=>({surface:'collection' as const,entry})),...homeEntries.filter(entry=>entry.featureId===id).map(entry=>({surface:'home' as const,entry}))]);
  await webFeatures.install({id:'mote.saved-record-views',version:'1',components:[]},[
    {surface:'panel',entry:{id:'memory.saved',kind:'mote.memory',schemaVersion:1,representation:'saved-record',render:({value})=><MemoryRecordPanel record={JSON.parse(value.text)}/>}},
    {surface:'panel',entry:{id:'operation.saved',kind:'mote.operation',schemaVersion:1,representation:'saved-record',render:({value})=><details><summary>{moteText('保存记录（只读）')}</summary><pre className="feature-json">{value.text}</pre></details>}},
  ]);
  await webFeatures.install({id:'mote.source-material-views',version:'2',components:[]},sourceMaterialViews.map(entry=>({surface:'renderer' as const,entry})));
  await webFeatures.install({id:'mote.owner-questions',version:'1',components:[]},ownerQuestionPanels.map(entry=>({surface:'panel' as const,entry})));
})();
