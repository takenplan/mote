import { moteText } from '@mote/shared/i18n';
import React from "react";
const StorageStatistics = React.lazy(() => import('../StorageStatistics').then(module => ({ default: module.StorageStatistics })));
const ContentStorage = React.lazy(() => import('../ContentStorage').then(module => ({ default: module.ContentStorage })));
import { Vault } from '../Vault';
import {MaintenanceFrame} from '../MaintenanceFrame';
import type { PageEntry, PageProps } from './types';
export const pages: PageEntry[] = [
    { id: 'vault', route: 'system/storage', get label() { return moteText('存储与备份'); }, section: 'system', order: 6, featureId: 'mote.storage', render: ({ api, status, refresh, disconnect }: PageProps) => status ? <MaintenanceFrame title={moteText('存储与备份')}><Vault api={api} embedded status={status} refresh={refresh} disconnect={disconnect}><ContentStorage api={api} onChange={refresh}/></Vault></MaintenanceFrame> : null },
    { id: 'statistics', route: 'system', get label() { return moteText("运行状态与空间"); }, section: 'system', order: 0, featureId: 'mote.storage', render: ({ api, onPage }: PageProps) => <StorageStatistics api={api} onUsage={() => onPage("usage")}/> },
];
