import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {ROOT,FIXTURES,CANDIDATE,assert,verifyCandidate} from './http-runtime.mjs';

const phases={calibration:'calibrate.mjs',boundaries:'boundaries.mjs',final:'final-evaluation.mjs'};
const phase=process.argv[2];
assert(phases[phase],'Usage: node --import tsx apps/server/test/fixtures/extension-final-evaluator/run.mjs calibration|boundaries|final');
await mkdir(ROOT,{recursive:true});
const verification=await verifyCandidate();
const startedAt=new Date().toISOString();
console.log(JSON.stringify({phase,outputDirectory:ROOT,candidateDirectory:CANDIDATE,verification,publishedRegression:true,regressionMode:'current-host',originalArchiveCommit:verification.originalArchiveCommit}));
const child=spawn(process.execPath,['--import','tsx',join(FIXTURES,phases[phase])],{
  cwd:CANDIDATE,env:{...process.env,R5_OUTPUT_DIR:ROOT,R5_CANDIDATE:CANDIDATE},stdio:'inherit',
});
const result=await new Promise((resolve,reject)=>{
  child.once('error',reject);
  child.once('exit',(code,signal)=>resolve({code,signal}));
});
await writeFile(join(ROOT,'phase-receipt.json'),JSON.stringify({phase,startedAt,completedAt:new Date().toISOString(),regressionMode:'current-host',verification,...result},null,2));
process.exitCode=result.code??1;
