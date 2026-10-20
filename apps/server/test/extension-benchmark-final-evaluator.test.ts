import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const execute=promisify(execFile);
const entry=fileURLToPath(new URL('./fixtures/extension-final-evaluator/run.mjs',import.meta.url));
const candidate=fileURLToPath(new URL('../../../',import.meta.url));

for(const phase of ['calibration','boundaries','final']) {
  test('Published Round 5 independent evaluator regression: '+phase,{timeout:115000},async t=>{
    const output=await mkdtemp(join(tmpdir(),'mote-r5-'+phase+'-'));
    t.diagnostic('Retained generated evaluator evidence: '+output);
    const result=await execute(process.execPath,['--import','tsx',entry,phase],{
      cwd:candidate,env:{...process.env,R5_CANDIDATE:candidate,R5_OUTPUT_DIR:output},
      timeout:110000,maxBuffer:2*1024*1024,
    });
    assert.match(result.stdout,/"publishedRegression":true/);
    t.diagnostic(result.stdout.trim());
  });
}
