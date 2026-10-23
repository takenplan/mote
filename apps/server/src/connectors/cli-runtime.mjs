import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Pinned stable releases, checked against the official npm Registry on 2026-10-18.
// Lark hashes: @larksuite/cli@1.0.98 package/checksums.txt.
// DWS hashes: official v1.0.64 GitHub Release asset digests.
export const cliReleases={
 lark:{version:'1.0.98',binary:'lark-cli',repository:'larksuite/cli',archives:{
  'darwin-x64':['lark-cli-1.0.98-darwin-amd64.tar.gz','44a4ff98e969385fc4bb4d701735ba319307e50560fa6c4c956178d70ccc3525'],
  'darwin-arm64':['lark-cli-1.0.98-darwin-arm64.tar.gz','ee4a3209bbf8b74ea5c00a07d0da89b79f5e7f6abfd518a8b2d78a7a4f7e3f40'],
  'linux-x64':['lark-cli-1.0.98-linux-amd64.tar.gz','4a12dcb7a0aab25986d8bcd046cb45b08278531a9aac3a12b53cf3d94738fe80'],
  'linux-arm64':['lark-cli-1.0.98-linux-arm64.tar.gz','f798b26ce4b369d70411945e7f66bbe4382c411bc47d81950a662de7b69b41ed'],
 }},
 dingtalk:{version:'1.0.64',binary:'dws',repository:'DingTalk-Real-AI/dingtalk-workspace-cli',archives:{
  'darwin-x64':['dws-darwin-amd64.tar.gz','c3c7cde614012ef217debaeb80b42857b0f49e2227bfd8d88718c7aff8718e26'],
  'darwin-arm64':['dws-darwin-arm64.tar.gz','6a33ac7573343ba1cfb26ef126cfa1bdd17e126ddfdff49e450bae336107da23'],
  'linux-x64':['dws-linux-amd64.tar.gz','68fd68effdb05c4f7af5771dfc7bf6c10d97d219b3fb992dc99165b198fddb32'],
  'linux-arm64':['dws-linux-arm64.tar.gz','351504a475b60c51a7b4abeb1a79f4e8de8b2ce1f06f97e0a5791a996bfe29a9'],
 }},
};
export const cliRuntimeDirectory=fileURLToPath(new URL('../../../../.mote/connectors/',import.meta.url));
export function managedCliBinary(provider,directory=cliRuntimeDirectory,platform=process.platform,arch=process.arch){
 const release=cliReleases[provider];
 if(!release||!Object.hasOwn(release.archives,platform+'-'+arch))throw Error('Managed connector CLI platform is unsupported');
 return resolve(directory,provider+'-'+release.version+'-'+platform+'-'+arch,release.binary);
}
