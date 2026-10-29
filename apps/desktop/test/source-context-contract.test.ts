import {expect,it} from 'vitest';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

it('consumes the real Central owner source-context HTTP contract',async()=>{
 const {stdout}=await promisify(execFile)(process.execPath,['--import','tsx','--test','--test-reporter=tap',fileURLToPath(new URL('./source-context-contract.mts',import.meta.url))],{timeout:30000,maxBuffer:1024*1024}).catch(error=>{throw Error(`${error.message}\n${error.stdout??''}\n${error.stderr??''}`);});
 expect(stdout).toContain('# fail 0');
},35000);
