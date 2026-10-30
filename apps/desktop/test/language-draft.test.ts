import { describe, expect, it } from 'vitest';
import { keepLanguageAskDraft, takeLanguageAskDraft } from '../src/language-draft';

function session() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe('question draft during an explicit language reload', () => {
  it('restores exact unsent input and conversation once in the same owner/device scope', () => {
    const storage = session();
    const draft = { scope: 'generated-owner/device', question: '  Generated question\n第二行  ', conversationId: '612585bd-2c32-4406-83eb-5aeed1b8ef8f', view: 'conversation' as const };
    keepLanguageAskDraft(storage, draft);
    expect(takeLanguageAskDraft(storage, draft.scope)).toEqual(draft);
    expect(takeLanguageAskDraft(storage, draft.scope)).toBeUndefined();
  });

  it('discards a handoff from a different connection or device rather than exposing the question', () => {
    const storage = session();
    keepLanguageAskDraft(storage, { scope: 'previous-owner/device', question: 'Generated private scope', view: 'history' });
    expect(takeLanguageAskDraft(storage, 'new-owner/device')).toBeUndefined();
    expect(takeLanguageAskDraft(storage, 'previous-owner/device')).toBeUndefined();
  });

  it('reports unavailable session storage to the caller so language apply can retain the current window', () => {
    expect(() => keepLanguageAskDraft({ setItem() { throw Error('Generated storage failure'); } }, { scope: 'same', question: 'Keep this draft', view: 'history' })).toThrow('Generated storage failure');
  });
});


it('carries an uncertain admission ID separately from a later unsent draft without resubmitting it',()=>{
  const storage=session(),draft={scope:'generated-owner/device',question:'Later unsent input',view:'conversation' as const,pendingRequest:{id:'612585bd-2c32-4406-83eb-5aeed1b8ef8f',question:'Original admitted question'}};
  keepLanguageAskDraft(storage,draft);expect(takeLanguageAskDraft(storage,draft.scope)).toEqual(draft);expect(takeLanguageAskDraft(storage,draft.scope)).toBeUndefined();
});


it('carries an admitted unresolved run as identity only and never fabricates a request body',()=>{
  const storage=session(),draft={scope:'generated-owner/device',question:'Later local draft',view:'conversation' as const,unresolvedRun:{id:'612585bd-2c32-4406-83eb-5aeed1b8ef8f',conversationId:'192585bd-2c32-4406-83eb-5aeed1b8ef8f',stopPending:true as const}};
  keepLanguageAskDraft(storage,draft);const restored=takeLanguageAskDraft(storage,draft.scope)!;
  expect(restored).toEqual(draft);expect(restored.pendingRequest).toBeUndefined();expect(takeLanguageAskDraft(storage,draft.scope)).toBeUndefined();
});

it('retains an exact older reading anchor and submitted question only in the same scope',()=>{
  const storage=session(),draft={scope:'generated-owner/device',question:'Later local draft',view:'conversation' as const,conversationId:'612585bd-2c32-4406-83eb-5aeed1b8ef8f',reading:{oldestTurnId:'older-turn',scrollY:1200,anchor:{turnId:'visible-turn',top:-35}},submittedQuestion:'Already admitted question'};
  keepLanguageAskDraft(storage,draft);expect(takeLanguageAskDraft(storage,draft.scope)).toEqual(draft);
  keepLanguageAskDraft(storage,{...draft,reading:{...draft.reading,scrollY:Infinity}});expect(takeLanguageAskDraft(storage,draft.scope)).toBeUndefined();
  keepLanguageAskDraft(storage,{...draft,reading:{...draft.reading,anchor:{turnId:'',top:0}}});expect(takeLanguageAskDraft(storage,draft.scope)).toBeUndefined();
});
