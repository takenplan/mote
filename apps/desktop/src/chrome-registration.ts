import {mkdir,writeFile,chmod,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {CHROME_EXTENSION_ID,CHROME_NATIVE_HOST} from './chrome-constants';
export {CHROME_EXTENSION_ID,CHROME_NATIVE_HOST};
export async function registerChromeNativeHost(options:{profileDirectory:string;extensionDirectory:string;electronExecutable:string;nativeHostScript:string;homeDirectory?:string}):Promise<{extensionId:string;extensionDirectory:string;manifestPath:string}>{
  const profile=resolve(options.profileDirectory);await mkdir(profile,{recursive:true,mode:0o700});const stat=await lstat(profile);if(stat.isSymbolicLink()||stat.uid!==process.getuid?.())throw Error('Untrusted profile directory');await chmod(profile,0o700);
  const quote=(s:string)=>`'${s.replace(/'/g,"'\\''")}'`;
  const launcher=join(profile,'chrome-native-host.sh');
  await writeFile(launcher,`#!/bin/sh\nexport ELECTRON_RUN_AS_NODE=1\nexport MOTE_CHROME_BRIDGE_DESCRIPTOR=${quote(join(profile,'chrome-bridge.json'))}\nexec ${quote(resolve(options.electronExecutable))} ${quote(resolve(options.nativeHostScript))} "$@"\n`,{mode:0o700});await chmod(launcher,0o700);
  const directory=join(options.homeDirectory??homedir(),'Library','Application Support','Google','Chrome','NativeMessagingHosts');await mkdir(directory,{recursive:true,mode:0o700});
  const manifestPath=join(directory,`${CHROME_NATIVE_HOST}.json`);await writeFile(manifestPath,JSON.stringify({name:CHROME_NATIVE_HOST,description:'Mote visible context relay',path:launcher,type:'stdio',allowed_origins:[`chrome-extension://${CHROME_EXTENSION_ID}/`]},null,2)+'\n',{mode:0o600});
  return {extensionId:CHROME_EXTENSION_ID,extensionDirectory:resolve(options.extensionDirectory),manifestPath};
}
