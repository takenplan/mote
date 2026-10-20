import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import test from 'node:test';
import performanceReporter, { CASE_BUDGET_MS, FILE_BUDGET_MS, PerformanceSummary } from './performance-reporter.mjs';

const cwd = resolve('/generated');
const file = join(cwd, 'generated.test.ts');
const summary = (duration_ms: number, path = file) => ({ type: 'test:summary', data: { file: path, duration_ms } });
const completed = (name: string, duration_ms: number, extra = {}, type = 'test:pass') => ({
  type, data: { file, line: 10, name, details: { type: 'test', duration_ms }, ...extra },
});

test('performance reminders use strict thresholds and native file wall time rather than nested sums', () => {
  const exact = new PerformanceSummary(cwd);
  exact.observe(summary(FILE_BUDGET_MS));
  exact.observe(completed('exact boundary', CASE_BUDGET_MS));
  assert.match(exact.report(), /0 files over budget; 0 cases over reminder/);

  const nested = new PerformanceSummary(cwd);
  nested.observe(summary(10_000));
  nested.observe(completed('parent', 45_000));
  nested.observe(completed('nested', 45_000, { nesting: 1 }));
  assert.match(nested.report(), /0 files over budget; 2 cases over reminder/);

  const over = new PerformanceSummary(cwd);
  over.observe(summary(FILE_BUDGET_MS + 1));
  over.observe(completed('just above', CASE_BUDGET_MS + 1));
  assert.match(over.report(), /1 files over budget; 1 cases over reminder/);
});

test('performance reminders retain failed cases and exclude suites, skipped and TODO cases', () => {
  const timings = new PerformanceSummary(cwd);
  timings.observe(completed('failed case', 31_000, {}, 'test:fail'));
  timings.observe(completed('skipped case', 90_000, { skip: 'generated skip' }));
  timings.observe(completed('todo case', 90_000, { todo: true }));
  timings.observe(completed('suite', 90_000, { details: { type: 'suite', duration_ms: 90_000 } }));
  timings.observe({ type: 'test:diagnostic', data: { message: 'generated diagnostic' } });
  const report = timings.report();
  assert.match(report, /1 cases over reminder/);
  assert.match(report, /case 31.00s generated.test.ts:10 \[failed\] failed case/);
  assert.doesNotMatch(report, /skipped case|todo case|generated diagnostic|case 90/);
});

test('performance evidence distinguishes absent summaries and rejects invalid durations', () => {
  const timings = new PerformanceSummary(cwd);
  for (const duration of [NaN, Infinity, -1]) timings.observe(summary(duration));
  assert.match(timings.report(), /0 observed file summaries/);
  assert.match(timings.report(), /No overall run summary received/);
  timings.observe(summary(61_000));
  timings.observe(summary(62_000));
  timings.observe({ type: 'test:summary', data: { duration_ms: 100_000 } });
  const report = timings.report();
  assert.match(report, /1 observed file summaries/);
  assert.match(report, /file 62.00s generated.test.ts/);
  assert.doesNotMatch(report, /file 61.00s|file 100.00s|No overall run summary/);
});

test('performance report includes every over-budget file and case in descending order', () => {
  const timings = new PerformanceSummary(cwd);
  for (let index = 1; index <= 12; index++) {
    timings.observe(summary(FILE_BUDGET_MS + index * 1000, join(cwd, `${index}.test.ts`)));
    timings.observe(completed(`case ${index}`, CASE_BUDGET_MS + index * 1000));
  }
  const report = timings.report();
  assert.match(report, /12 files over budget; 12 cases over reminder/);
  assert.equal(report.match(/\[test-performance\] file /g)?.length, 12);
  assert.equal(report.match(/\[test-performance\] case /g)?.length, 12);
  assert.ok(report.indexOf('file 72.00s') < report.indexOf('file 61.00s'));
  assert.ok(report.indexOf('case 42.00s') < report.indexOf('case 31.00s'));
});

test('performance reporter consumes native events once, preserves spec output and propagates stream errors', async () => {
  let consumed = 0;
  async function* source() {
    consumed++;
    yield { type: 'test:diagnostic', data: { nesting: 0, message: 'GENERATED_SPEC_DIAGNOSTIC' } };
  }
  let output = '';
  for await (const chunk of performanceReporter(source())) output += chunk;
  assert.equal(consumed, 1);
  assert.ok(output.indexOf('GENERATED_SPEC_DIAGNOSTIC') < output.indexOf('[test-performance]'));
  assert.match(output, /advisory only/);
  const failure = Error('GENERATED_REPORT_STREAM_FAILURE');
  async function* broken() { yield* source(); throw failure; }
  await assert.rejects(async () => {
    for await (const _chunk of performanceReporter(broken())) { /* Drain the actual composed reporter. */ }
  }, error => error === failure);
});
