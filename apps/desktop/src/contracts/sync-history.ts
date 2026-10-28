/** Renderer/main data contract. Keep platform and implementation dependencies outside this module. */

export type SyncSource = 'screen' | 'ui_page' | 'note' | 'activity' | 'notification' | 'media' | 'file' | 'calendar' | 'coding';
export type SyncOutcome = 'sending' | 'received' | 'unconfirmed' | 'interrupted';
export interface SyncHistoryItem {
  key: string; source: SyncSource; title: string; observedAt: string;
  captureId?: string; sourceId?: string; versionKey?: string; layer?: string;
  outcome: SyncOutcome; code?: number; firstReceipt: boolean;
}
export interface SyncHistoryRun {
  id: string; startedAt: string; finishedAt?: string; trigger: 'automatic' | 'manual';
  outcome: 'sending' | 'received' | 'partial' | 'unconfirmed' | 'interrupted';
  bytes: number; total: number; received: number; unconfirmed: number; sources: SyncSource[];
}
export interface SyncHistoryQuery { day: string; days?: 1 | 7; offset?: number; source?: SyncSource; outcome?: 'received' | 'unconfirmed' }
export interface SyncHistoryPage {
  items: SyncHistoryRun[]; total: number; offset: number; nextOffset?: number;
  received: number; bytes: number; since: string;
  days: { day: string; received: number }[]; sources: { source: SyncSource; received: number }[];
}
export interface SyncHistoryContentQuery { runId: string; offset?: number; source?: SyncSource; outcome?: 'received' | 'unconfirmed' }

export interface SyncHistoryContentPage { run: SyncHistoryRun; items: SyncHistoryItem[]; total: number; offset: number; nextOffset?: number }
