import { relative } from 'node:path';
import { Readable } from 'node:stream';
import { spec } from 'node:test/reporters';

export const FILE_BUDGET_MS = 60_000;
export const CASE_BUDGET_MS = 30_000;

const seconds = milliseconds => `${(milliseconds / 1000).toFixed(2)}s`;
const validDuration = value => Number.isFinite(value) && value >= 0;

export class PerformanceSummary {
  #files = new Map();
  #slowCases = [];
  #overall = false;
  #cwd;

  constructor(cwd = process.cwd()) { this.#cwd = cwd; }

  observe({ type, data }) {
    if (type === 'test:summary') {
      if (!data.file) this.#overall = true;
      else if (validDuration(data.duration_ms)) this.#files.set(data.file, data.duration_ms);
    }
    if ((type === 'test:pass' || type === 'test:fail') && data.details?.type === 'test'
      && !data.skip && !data.todo && validDuration(data.details.duration_ms)
      && data.details.duration_ms > CASE_BUDGET_MS) {
      this.#slowCases.push({ ...data, failed: type === 'test:fail' });
    }
  }

  report() {
    const location = data => `${data.file ? relative(this.#cwd, data.file) : '(unknown file)'}${data.line ? `:${data.line}` : ''}`;
    const slowFiles = [...this.#files].filter(([, duration]) => duration > FILE_BUDGET_MS)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const lines = [
      `\n[test-performance] ${this.#files.size} observed file summaries; file budget 60s, case reminder 30s (advisory only).`,
      ...(this.#overall ? [] : ['[test-performance] No overall run summary received; timing evidence may be incomplete.']),
      `[test-performance] ${slowFiles.length} files over budget; ${this.#slowCases.length} cases over reminder.`,
      ...slowFiles.map(([file, duration]) => `[test-performance] file ${seconds(duration)} ${location({ file })}`),
      ...this.#slowCases.sort((a, b) => b.details.duration_ms - a.details.duration_ms
        || location(a).localeCompare(location(b)) || a.name.localeCompare(b.name))
        .map(data => `[test-performance] case ${seconds(data.details.duration_ms)} ${location(data)}${data.failed ? ' [failed]' : ''} ${data.name.replace(/[\r\n\t]/g, ' ')}`),
      '[test-performance] Timings depend on host load and concurrency; retain assertions, scale, lifecycle coverage and existing deadlines.',
    ];
    return lines.join('\n') + '\n';
  }
}

export default async function* performanceReporter(source) {
  const summary = new PerformanceSummary();
  async function* observed() {
    for await (const event of source) {
      summary.observe(event);
      yield event;
    }
  }
  // compose propagates errors/backpressure; Node still owns test exit status.
  yield* Readable.from(observed()).compose(new spec());
  yield summary.report();
}
