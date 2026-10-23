import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {managedCliBinary} from '../apps/server/src/connectors/cli-runtime.mjs';
import {larkArguments,LARK_VERSION,type LarkCommand} from '../apps/server/src/connectors/lark-cli.js';
import {dwsArguments,DWS_VERSION,type DwsCommand} from '../apps/server/src/connectors/dingtalk-recordings.js';

// Explicit optional offline check of deployment-prepared binaries. No auth/status
// or business command executes: every command ends in --help, except version.
const directory=process.argv[2]?resolve(process.argv[2]):undefined,home=mkdtempSync(join(tmpdir(),'mote-cli-contract-'));
try{
 const env={PATH:process.env.PATH,HOME:home,USERPROFILE:home,CI:'1',NO_COLOR:'1',DWS_CONFIG_DIR:join(home,'dws'),DWS_KEYCHAIN_DIR:join(home,'credentials'),DWS_DISABLE_KEYCHAIN:'1',DWS_NO_UPDATE_CHECK:'1',LARKSUITE_CLI_CONFIG_DIR:join(home,'lark-config'),LARKSUITE_CLI_DATA_DIR:join(home,'lark-data'),LARKSUITE_CLI_LOG_DIR:join(home,'lark-logs'),LARKSUITE_CLI_NO_UPDATE_NOTIFIER:'1',LARKSUITE_CLI_NO_SKILLS_NOTIFIER:'1'};
 const call=(provider:'lark'|'dingtalk',args:string[])=>execFileSync(managedCliBinary(provider,directory),args,{env,cwd:home,encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']});
 assert.equal(call('lark',['--version']).match(/\b\d+\.\d+\.\d+\b/)?.[0],LARK_VERSION);
 assert.equal(JSON.parse(call('dingtalk',['version','--format','json'])).version,'v'+DWS_VERSION);
 const lark:LarkCommand[]=[{kind:'status'},{kind:'setup'},{kind:'configure',appId:'cli_generated',secret:'GENERATED_NEVER_TRANSMITTED',brand:'feishu'},{kind:'login',scopes:['minutes:minutes.basic:read']},{kind:'complete',deviceCode:'GENERATED_NEVER_TRANSMITTED'},{kind:'calendars'},{kind:'events',calendarId:'generated',start:1,end:2},{kind:'document',document:'GeneratedDocument'},{kind:'documents-search',action:'opened',start:'2026-10-01T00:00:00Z',end:'2026-10-02T00:00:00Z'},{kind:'folder-list',folder:'GeneratedFolder'},{kind:'wiki-node',node:'GeneratedNode'},{kind:'wiki-list',spaceId:'GeneratedSpace',parent:'GeneratedParent'},{kind:'minutes-search',start:'2026-10-01T00:00:00Z',end:'2026-10-02T00:00:00Z'},{kind:'minutes-metadata',id:'GeneratedMinute'},{kind:'minutes-transcript',id:'GeneratedMinute'},{kind:'minutes-media',id:'GeneratedMinute',output:'generated/audio'}];
 const dws:DwsCommand[]=[{kind:'login'},{kind:'status'},{kind:'search',start:'2026-10-01T00:00:00Z',end:'2026-10-02T00:00:00Z'},{kind:'metadata',id:'GeneratedMinute'},{kind:'transcript',id:'GeneratedMinute'},{kind:'media',id:'GeneratedMinute',output:'generated/audio'}];
 for(const command of lark){const help=call('lark',[...larkArguments(command),'--help']);assert.match(help,/Usage:|Risk:/);}
 for(const command of dws){const help=call('dingtalk',[...dwsArguments(command),'--help']);assert.match(help,/Usage:/);}
 console.log(JSON.stringify({passed:true,larkVersion:LARK_VERSION,dwsVersion:DWS_VERSION,helpContracts:lark.length+dws.length,generatedOnly:true,accountCalls:0,modelCalls:0}));
}finally{rmSync(home,{recursive:true,force:true});}
