/** Renderer/main data contract. Keep platform and implementation dependencies outside this module. */
import type { ProtocolRange } from '@mote/shared/protocol';

export interface ConnectionPreview { id: string; serverUrl: string; expiresAt: string }
export interface ConnectionIdentity {
  credential: { id: string; scope: 'owner'; label: string; deviceId?: string; deviceName?: string; platform?: string; serverUrl?: string };
  node: { version: string; profile: string; protocol: ProtocolRange };
  capabilities: { ingest: boolean; ingressVersion?: number; ownSources: boolean; archiveRead: boolean };
}
export interface ConnectionStatus { state: 'unchecked' | 'checking' | 'connected' | 'error'; message: string; checkedAt?: string; identity?: ConnectionIdentity }
