import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {ConfigStore,CredentialStorageMismatch,publicConfig} from '../src/config';
import {DesktopPairing} from '../src/connection-pairing';
import {desktopSecretStorage} from '../src/secret-storage';
import {isDevelopmentProfile,profileDefaults,resolveProfile} from '../src/profile';

let directory:string;
beforeEach(async()=>{directory=await mkdtemp(join(tmpdir(),'mote-development-storage-'));});
afterEach(async()=>{await rm(directory,{recursive:true,force:true});});
const forbidden=()=>{throw Error('Development must never access the OS credential store');};
const unavailableSystem={isEncryptionAvailable:forbidden,getSelectedStorageBackend:forbidden,encryptString:forbidden,decryptString:forbidden};

it.each([{name:'dev',developmentBuild:false},{name:'default',developmentBuild:true},{name:'prod',developmentBuild:true}])('persists and restarts $name credentials without touching Keychain (Dev build $developmentBuild)',async({name,developmentBuild})=>{
 const profile=resolveProfile([`--profile=${name}`],{},directory),storage=desktopSecretStorage(profile,developmentBuild,unavailableSystem);
 const defaults=()=>profileDefaults(profile,{},developmentBuild),store=new ConfigStore(profile.dataDirectory,storage,defaults);
 const config={...await store.load(),token:'generated-development-token-0123456789012345',authExpiresAt:Date.now()+60000};
 expect(config.diagnosticsEnabled).toBe(true);expect(isDevelopmentProfile(profile,developmentBuild)).toBe(true);
 await store.save(config);
 const path=join(profile.dataDirectory,'config.json'),saved=JSON.parse(await readFile(path,'utf8'));
 expect(saved.developmentToken).toBe(config.token);expect(saved.encryptedToken).toBeUndefined();expect(saved.config.token).toBeUndefined();
 expect((await stat(path)).mode&0o777).toBe(0o600);expect((await stat(profile.dataDirectory)).mode&0o777).toBe(0o700);
 const restarted=await new ConfigStore(profile.dataDirectory,desktopSecretStorage(profile,developmentBuild,unavailableSystem),defaults).load();
 expect(restarted).toEqual(config);expect(publicConfig(restarted)).not.toHaveProperty('token');
 await store.save({...restarted,authSessionOnly:true});
 expect(await readFile(path,'utf8')).not.toContain(config.token);expect((await store.load()).token).toBeUndefined();
 await store.save({...restarted,token:undefined,authSignedOut:true});
 expect(await readFile(path,'utf8')).not.toContain(config.token);expect((await store.load()).authSignedOut).toBe(true);
});

it('keeps production OS encryption mandatory and rejects development credentials without silently adopting them',async()=>{
 const profile=resolveProfile(['--profile=prod'],{},directory),system={isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'keychain',encryptString:vi.fn((value:string)=>Buffer.from(value).map(v=>v^90)),decryptString:vi.fn((value:Buffer)=>Buffer.from(value.map(v=>v^90)).toString())};
 const storage=desktopSecretStorage(profile,false,system),store=new ConfigStore(profile.dataDirectory,storage,()=>profileDefaults(profile,{}));
 const config={...await store.load(),token:'generated-production-token-0123456789012345'};
 expect(config.diagnosticsEnabled).toBe(false);expect(isDevelopmentProfile(profile)).toBe(false);
 await store.save(config);expect(system.encryptString).toHaveBeenCalledOnce();expect(await readFile(join(profile.dataDirectory,'config.json'),'utf8')).not.toContain(config.token);
 expect((await store.load()).token).toBe(config.token);expect(system.decryptString).toHaveBeenCalledOnce();
 const preserved=await readFile(join(profile.dataDirectory,'config.json'));
 const devStore=new ConfigStore(profile.dataDirectory,desktopSecretStorage(profile,true,unavailableSystem));
 await expect(devStore.load()).rejects.toBeInstanceOf(CredentialStorageMismatch);expect(await readFile(join(profile.dataDirectory,'config.json'))).toEqual(preserved);
 await devStore.save(config);
 await expect(store.load()).rejects.toBeInstanceOf(CredentialStorageMismatch);expect(system.decryptString).toHaveBeenCalledOnce();
 const insecure=desktopSecretStorage(profile,false,{...system,isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'basic_text'},'linux');
 await expect(new ConfigStore(join(directory,'linux'),insecure).save(config)).rejects.toThrow('明文');
});

it.each(['json','system'] as const)('preserves a pending claim from the other storage policy before any network request (%s)',async mode=>{
 const profile=resolveProfile([`--profile=${mode==='json'?'dev':'prod'}`],{},directory);
 const storage=desktopSecretStorage(profile,false,unavailableSystem),pairing=new DesktopPairing(directory,storage,vi.fn());
 const other=join(directory,mode==='json'?'connection-pending.enc':'connection-pending.json');
 await writeFile(other,'generated existing pending claim',{mode:0o600});
 await expect(pairing.preview(profileDefaults(profile,{}))).rejects.toBeInstanceOf(CredentialStorageMismatch);
 expect(await readFile(other,'utf8')).toBe('generated existing pending claim');
});
