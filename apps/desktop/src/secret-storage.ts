import type { SecretStorage } from './config';
import { isDevelopmentProfile, type DesktopProfile } from './profile';

interface SystemSecretStorage {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend(): string;
  encryptString(value: string): Buffer;
  decryptString(value: Buffer): string;
}

/** Select before touching the OS store. Development must never open Keychain. */
export function desktopSecretStorage(profile: DesktopProfile, developmentBuild: boolean, system: SystemSecretStorage, platform = process.platform): SecretStorage {
  if (isDevelopmentProfile(profile, developmentBuild)) return {
    mode: 'json', available: () => true,
    encrypt: value => Buffer.from(value, 'utf8'), decrypt: value => value.toString('utf8'),
  };
  return {
    mode: 'system',
    available: () => system.isEncryptionAvailable() && (platform !== 'linux' || system.getSelectedStorageBackend() !== 'basic_text'),
    encrypt: value => system.encryptString(value), decrypt: value => system.decryptString(value),
  };
}
