export interface ScopedInstanceManifest {
 version:2;kind:'mote-instance-backup';storageEpoch:5;deploymentId:string;createdAt:string;
 directories:string[];checksums:Record<string,string>;native:string[];
 coverage:{canonicalDatabase:true;identities:true;originals:true;configuration:true;plugins:true;providerNative:true;privateKeyMaterial:true;excluded:string[]};
 restore:{identity:'preserved';executionAuthority:'revoked';automaticWork:false};
}
export interface VerifiedScopedBackup {directory:string;names:string[];checksums:Record<string,string>;manifest:ScopedInstanceManifest}
export function assertScopedStopped(directory:string):Promise<void>;
export function isScopedVault(source:string):Promise<boolean>;
export function backupScopedInstance(options:{source:string;out:string;configFile?:string}):Promise<{directory:string;manifest:ScopedInstanceManifest}>;
export function verifiedScopedBackup(directory:string):Promise<VerifiedScopedBackup>;
export function stageScopedRestore(checked:VerifiedScopedBackup,stage:string,target?:string):Promise<string[]>;
export function restoreScopedInstance(options:{from:string;target:string;deploymentId?:string}):Promise<{restored:true;deploymentId:string;directory:string;configurationFile:string}>;
