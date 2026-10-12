import { moteText } from '@mote/shared/i18n';
import React from "react";
const StorageStatistics = React.lazy(() => import('../StorageStatistics').then(module => ({ default: module.StorageStatistics })));
const ContentStorage = React.lazy(() => import('../ContentStorage').then(module => ({ default: module.ContentStorage })));
import { Vault } from '../Vault';
import type { PageEntry, PageProps } from './types';
export const pages: PageEntry[] = [
    { id: 'vault', route: 'system/storage', get label() { return moteText("存储、加密与备份"); }, section: 'system', order: 6, featureId: 'mote.storage', render: ({ api, status, onPage, refresh, disconnect }: PageProps) => status ? (<><div className="page-heading"><h1>{moteText("存储、加密与备份")}</h1><p>{moteText("空间详情、归档导入与导出")}</p></div><ContentStorage api={api} onChange={refresh}/><Vault api={api} embedded status={status} refresh={refresh} disconnect={disconnect}/></>) : null },
    { id: 'statistics', route: 'system', get label() { return moteText("运行状态与空间"); }, section: 'system', order: 0, featureId: 'mote.storage', render: ({ api, onPage }: PageProps) => <StorageStatistics api={api} onUsage={() => onPage("usage")}/> },
];
