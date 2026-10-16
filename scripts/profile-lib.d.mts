import type {ConfigDocument} from '../packages/shared/src/config-file.js';
import type {ScopedInstanceManifest} from './scoped-backup.mjs';

export interface ProfilePaths {
 profile:string;home:string;directory:string;configFile:string;envFile:string;
 legacyEnvFile:string;metaFile:string;processFile:string;project:string;
}
export interface LoadedProfile extends ProfilePaths {
 document:ConfigDocument;savedDocument:ConfigDocument;env:Record<string,string>;
 meta:{version:1;profile:string;runtime:'native'|'docker';release:string;image:string;volume:string;modelsVolume:string;[key:string]:unknown};
 port:number;dataDir:string;modelDirectory:string;url:string;
}
export interface ExecuteOptions {env?:NodeJS.ProcessEnv;cwd?:string;capture?:boolean;timeoutMs?:number}
export type ProfileExecutor=(command:string,args:string[],options?:ExecuteOptions)=>Promise<string>;
export interface ProfileDependencies {
 execute?:ProfileExecutor;
 configurationUser?:(profile:LoadedProfile,execute:ProfileExecutor)=>Promise<string>;
}
export interface NativeRestoreTarget {meta:{runtime:'native'};dataDir:string;processFile:string}
export interface RestoredProfile {
 restored:true;source:string;deploymentId?:string;volume?:string;previousVolume?:string;
 configurationFile?:string;profileConfigurationPreserved?:true;started?:false;
}
export interface VerifiedProfileBackup {
 directory:string;names:string[];checksums:Record<string,string>;manifest?:ScopedInstanceManifest;
}
export const repository:string;
export const ports:{dev:number;test:number;prod:number};
export function profilePaths(profile?:string,home?:string):ProfilePaths;
export function initialize(paths:ProfilePaths,options?:{runtime?:'native'|'docker';port?:number|string;image?:string;volume?:string;'data-dir'?:string}):Promise<{
 profile:string;runtime:'native'|'docker';port:number;configurationFile:string;
 storage:{kind:'docker-volume'|'local-directory';source:string;mount:string};
 dataDir:string|undefined;volume:string|undefined;project:string;
}>;
export function loadProfile(paths:ProfilePaths):Promise<LoadedProfile>;
export function execute(command:string,args:string[],options?:ExecuteOptions):Promise<string>;
export function dockerConfigurationUser(profile:LoadedProfile,execute?:ProfileExecutor):Promise<string>;
export function backupProfile(profile:LoadedProfile,out?:string,dependencies?:ProfileDependencies):Promise<string>;
export function verifiedBackup(backup:string):Promise<VerifiedProfileBackup>;
export function restoreProfile(profile:LoadedProfile|NativeRestoreTarget,backup:string,dependencies?:ProfileDependencies):Promise<RestoredProfile>;
export function setPublicUrl(profile:LoadedProfile,url:string):Promise<void>;
