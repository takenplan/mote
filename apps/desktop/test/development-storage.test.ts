import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigStore, CredentialStorageMismatch, publicConfig, signedOutConfig } from '../src/config';
import { desktopSecretStorage } from '../src/secret-storage';
import { profileDefaults, resolveProfile } from '../src/profile';
import { connectionToken, sourceConnectionBinding } from '../src/login-session';

let directory: string;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'mote-development-storage-')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
const forbidden = () => { throw Error('Development must never construct or call OS credential storage'); };

it.each([{name:'dev',build:false},{name:'default',build:true},{name:'prod',build:true}])('Dev credentials survive save/restart without constructing OS storage ($name, Dev build $build)', async ({name,build}) => {
  const profile = resolveProfile([`--profile=${name}`], {}, directory);
  const store = new ConfigStore(profile.dataDirectory, desktopSecretStorage(profile, build, forbidden), () => profileDefaults(profile, {}));
  const config = {...await store.load(),token:'generated-development-token-0123456789012345',credentialScope:'owner' as const,authExpiresAt:Date.now()+60000};
  await store.save(config);
  const path = join(profile.dataDirectory, 'config.json'), saved = JSON.parse(await readFile(path, 'utf8'));
  expect(saved.developmentToken).toBe(config.token); expect(saved.encryptedToken).toBeUndefined(); expect(saved.config.token).toBeUndefined();
  expect((await stat(path)).mode & 0o777).toBe(0o600); expect((await stat(profile.dataDirectory)).mode & 0o777).toBe(0o700);
  const restarted = await new ConfigStore(profile.dataDirectory, desktopSecretStorage(profile, build, forbidden)).load();
  expect(restarted).toEqual(config); expect(publicConfig(restarted)).not.toHaveProperty('token');
  await store.save({...restarted,authSessionOnly:true});
  expect(await readFile(path,'utf8')).not.toContain(config.token); expect((await store.load()).token).toBeUndefined();
  const signedOut = signedOutConfig(restarted);
  expect(signedOut).toMatchObject({authSignedOut:true,authSourceBinding:sourceConnectionBinding(config)});
  for (const key of ['token','credentialScope','authExpiresAt','authSessionOnly']) expect(signedOut[key as keyof typeof signedOut]).toBeUndefined();
  await store.save(signedOut);
  expect(await readFile(path,'utf8')).not.toContain(config.token); expect(await store.load()).toEqual(signedOut);
  expect(connectionToken(await store.load())).toBeUndefined();
  await store.save({...config,authSignedOut:true});
  expect(await readFile(path,'utf8')).not.toContain(config.token); expect((await store.load()).token).toBeUndefined();
});

it('Prod uses OS encryption and refuses plaintext fallback or Dev credential adoption', async () => {
  const profile = resolveProfile(['--profile=prod'], {}, directory);
  const system = {isEncryptionAvailable:()=>true,getSelectedStorageBackend:()=> 'keychain',encryptString:vi.fn((value:string)=>Buffer.from(value).map(v=>v^90)),decryptString:vi.fn((value:Buffer)=>Buffer.from(value.map(v=>v^90)).toString())};
  const store = new ConfigStore(profile.dataDirectory, desktopSecretStorage(profile, false, () => system), () => profileDefaults(profile, {}));
  const config = {...await store.load(),token:'generated-production-token-0123456789012345'};
  await store.save(config); expect(system.encryptString).toHaveBeenCalledOnce();
  const path = join(profile.dataDirectory,'config.json'), preserved = await readFile(path);
  expect(preserved.toString()).not.toContain(config.token); expect((await store.load()).token).toBe(config.token); expect(system.decryptString).toHaveBeenCalledOnce();
  const devStore = new ConfigStore(profile.dataDirectory, desktopSecretStorage(profile, true, forbidden));
  await expect(devStore.load()).rejects.toBeInstanceOf(CredentialStorageMismatch); expect(await readFile(path)).toEqual(preserved);
  await devStore.save(config);
  const development = await readFile(path);
  await expect(store.load()).rejects.toBeInstanceOf(CredentialStorageMismatch); expect(await readFile(path)).toEqual(development); expect(system.decryptString).toHaveBeenCalledOnce();
  const insecure = desktopSecretStorage(profile,false,()=>({...system,getSelectedStorageBackend:()=> 'basic_text'}),'linux');
  await expect(new ConfigStore(join(directory,'insecure'),insecure).save(config)).rejects.toThrow('明文');
});

it('a custom profile prefix does not silently select Dev credential policy', async () => {
  const profile = resolveProfile(['--profile=dev-other'],{},directory);
  const store = new ConfigStore(profile.dataDirectory,desktopSecretStorage(profile,false,forbidden));
  await expect(store.save({...profileDefaults(profile,{}),token:'generated-token'})).rejects.toThrow('OS credential storage');
});
