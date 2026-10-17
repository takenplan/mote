import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('the actual export stream delivers a source authorization failure to its returned gzip without a process crash or hang', () => {
  const entry = new URL('../src/file-export-tar.ts', import.meta.url).href;
  const script = `
    const {exportTar} = await import(${JSON.stringify(entry)});
    let checks=0;
    const output=exportTar([{name:'generated.txt',bytes:Buffer.from('Generated private original')}],()=>{if(++checks===2)throw Error('generated-authority-revoked');});
    const deadline=setTimeout(()=>{console.error('export did not settle');process.exit(2);},3000);
    output.on('error',error=>{if(error.message!=='generated-authority-revoked')process.exitCode=3;else console.log('returned-export-error-settled');clearTimeout(deadline);});
    output.resume();
  `;
  const result = spawnSync(process.execPath, ['--import','tsx','--input-type=module','-e',script], {cwd:process.cwd(),encoding:'utf8',timeout:5000});
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /returned-export-error-settled/);
});
