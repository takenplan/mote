import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Public wire-2 UI entry. The native runners hide their windows and replace
// external capture/calendar/credential I/O with generated data only.
const repository=fileURLToPath(new URL('../../../',import.meta.url));
const electron=createRequire(import.meta.url)('electron');
function run(binary,args,env,label){
 const result=spawnSync(binary,args,{cwd:repository,env:{...process.env,...env},stdio:'inherit'});
 if(result.error)throw result.error;
 assert.equal(result.status,0,`${label} failed (signal ${result.signal??'none'})`);
}
run(process.execPath,['--import','tsx','apps/desktop/scripts/multiuser-native-runner.mjs'],{},'Actual wire-2 account/theme lifecycle');
let cold=0,restarts=0;
for(const preference of ['light','dark','auto'])for(const os of ['light','dark']){
 const profile=await mkdtemp(join(tmpdir(),'mote-public-ui-appearance-'));
 try{
  await writeFile(join(profile,'fixture-marker'),'synthetic-only',{mode:0o600});
  const env={MOTE_THEME_FIXTURE_ROOT:profile,MOTE_THEME_FIXTURE_PREFERENCE:preference,MOTE_THEME_FIXTURE_OS:os,MOTE_THEME_FIXTURE_RESTART:''};
  run(electron,['apps/desktop/scripts/appearance-smoke.cjs'],env,`Cold ${preference}/${os}`);cold++;
  run(electron,['apps/desktop/scripts/appearance-smoke.cjs'],{...env,MOTE_THEME_FIXTURE_RESTART:'1'},`Restart ${preference}/${os}`);restarts++;
 }finally{await rm(profile,{recursive:true,force:true});}
}
console.log(JSON.stringify({ok:true,publicEntry:'test:ui',actualWire2AccountThemeLifecycle:true,appearanceCold:cold,appearanceNewProcesses:restarts,generatedOnly:true,ownedProfilesRemoved:true,legacyWire1CoverageClaimed:false}));
