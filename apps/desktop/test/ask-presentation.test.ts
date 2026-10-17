import { expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { renderAskAnswer, renderAskCitation, renderAskTurn } from '../src/ask-presentation';
import { configureLocale, moteText, type Locale } from '@mote/shared/i18n';
const id = '11111111-2222-4333-8444-555555555555';
const citation = { id, appName: 'Generated note', capturedAt: '2026-09-27', excerpt: 'Generated full excerpt\n末尾不丢失' };
it('formats prose and only declared citations, keeping code and authored links inert', () => {
  const document = new JSDOM('').window.document, opened: string[] = [];
  const view = renderAskAnswer(document, `# Result\n\n**Confirmed** [${id}]\n- first\n- second\n\n\`[${id}]\`\n\n[other-id]\n[${id}](https://example.test)`, [citation], value => opened.push(value));
  expect(view.querySelector('h3')?.textContent).toBe('Result');
  expect(view.querySelector('strong')?.textContent).toBe('Confirmed');
  expect(view.querySelectorAll('li')).toHaveLength(2);
  expect(view.querySelectorAll('button')).toHaveLength(1);
  view.querySelector('button')!.click(); expect(opened).toEqual([id]);
  expect(view.querySelector('code')?.textContent).toBe(`[${id}]`);
  expect(view.textContent).toContain('[other-id]');
  expect(view.querySelector('a')).toBeNull();
});
it('never interprets HTML, images, scripts or URLs as executable content', () => {
  const document = new JSDOM('').window.document;
  const text = '<script>window.bad=true</script>\n<img src="https://example.test/private">\n[run](javascript:alert(1))\n![image](https://example.test/private)\n```html\n<button onclick="bad()">untrusted</button>\n```';
  const view = renderAskAnswer(document, text, [], () => { throw Error('must not navigate'); });
  expect(view.querySelectorAll('script,img,a,button')).toHaveLength(0);
  expect(view.textContent).toContain('<img src="https://example.test/private">');
  expect(view.querySelector('pre code')?.textContent).toBe('<button onclick="bad()">untrusted</button>');
});
it('keeps exact evidence text and a visible original action outside the excerpt disclosure', () => {
  const document = new JSDOM('').window.document, opened: string[] = [];
  const view = renderAskCitation(document, citation, value => opened.push(value));
  expect(view.querySelector('.ask-excerpt')?.textContent).toBe(citation.excerpt);
  expect(view.querySelector('details button')).toBeNull();
  view.querySelector('button')!.click(); expect(opened).toEqual([id]);
  expect(view.querySelector('p')?.textContent).not.toContain(id);
});

it.each<Locale>(['zh-CN', 'en'])('keeps historical notices beside retained evidence and prioritizes deletion in %s', locale => {
  configureLocale(() => locale);
  try {
    const document = new JSDOM('').window.document, opened: string[] = [];
    const original = { question: 'Generated question', status: 'completed', result: { answer: 'Generated retained answer', citations: [citation] } };
    const stale = moteText('这是历史版本，当前资料已更新。'), deleted = moteText('相关证据已删除，这条历史回答已清除。可以继续提问查阅现有记录。');
    const current = renderAskTurn(document, original, id => opened.push(id));
    expect(current.textContent).toContain(original.result.answer); expect(current.querySelector('.helper')).toBeNull();
    const historical = renderAskTurn(document, { ...original, evidenceStale: true }, id => opened.push(id));
    expect(historical.querySelector('.helper')?.textContent).toBe(stale);
    expect(historical.querySelector('.ask-answer')?.textContent).toBe(original.result.answer);
    expect(historical.querySelector('.ask-excerpt')?.textContent).toBe(citation.excerpt);
    historical.querySelector<HTMLButtonElement>('.ask-evidence button')!.click(); expect(opened).toEqual([citation.id]);
    for (const result of [undefined, original.result]) {
      const erased = renderAskTurn(document, { ...original, result, evidenceStale: true, evidenceDeleted: true }, () => { throw Error('Erased evidence cannot navigate'); });
      expect(erased.querySelector('.helper')?.textContent).toBe(deleted);
      expect(erased.textContent).not.toContain(stale); expect(erased.textContent).not.toContain(original.result.answer);
      expect(erased.textContent).not.toContain(citation.excerpt); expect(erased.querySelectorAll('button,.ask-answer,.ask-evidence')).toHaveLength(0);
      expect(erased.querySelector('h3')?.textContent).toBe(original.question);
    }
    const failed = renderAskTurn(document, { question: original.question, status: 'failed', error: { message: 'Generated original failure' } }, () => {});
    expect(failed.querySelector('.ask-answer')?.textContent).toBe('Generated original failure'); expect(failed.querySelector('.helper')).toBeNull();
  } finally { configureLocale(() => 'zh-CN'); }
});
