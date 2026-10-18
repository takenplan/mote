import {ScopedOverview} from '../ScopedSummary';
import {AccountSettings} from '../AccountSettings';
import { moteText } from '@mote/shared/i18n';
import { Unplug } from "lucide-react";
import React from "react";
import { type SessionLifetime } from "../session";
const Feedback = React.lazy(() => import('../Feedback').then(module => ({ default: module.Feedback })));
import { SettingsLanding } from "../WorkspaceNavigation";
const SoftwareUpdate = React.lazy(() => import('../SoftwareUpdate').then(module => ({ default: module.SoftwareUpdate })));
import { Overview } from '../Overview';
import { FeatureGuide } from '../FeatureGuide';
import type { PageEntry, PageProps } from './types';
export const pages: PageEntry[] = [
    { id: 'featureGuide', route: 'guide', label: moteText("全部功能"), featureId: 'mote.system', render: ({ api,onPage }: PageProps) => <FeatureGuide api={api} onPage={onPage}/> },
    { id: 'overview', route: 'today', label: moteText('今天'), featureId: 'mote.system', render: ({ api, status, devices, recent, insights, onPage, onOpen: setEvidenceId, range, rangeSelectionKey }: PageProps) => api.connection?.mode==='web'?<ScopedOverview api={api} onPage={onPage} onOpen={setEvidenceId} range={range} rangeSelectionKey={rangeSelectionKey}/>:status ? (<Overview api={api} status={status} devices={devices} recent={recent} insights={insights} onPage={onPage} onOpen={setEvidenceId}/>) : null },
    { id: 'help', route: 'help', label: moteText('帮助与反馈'), featureId: 'mote.system', render: ({ status, onPage }: PageProps) => <><div className="page-heading"><h1>{moteText('帮助与反馈')}</h1><p>{moteText('检查连接、权限与处理状态，或提交问题反馈。')}</p></div><Feedback profile={status?.profile}/><button className="button" onClick={() => onPage('developer')}>{moteText('诊断与更新')}</button></> },
    { id: 'about', route: 'preferences', label: moteText('设置'), featureId: 'mote.system', render: ({ api, onPage, disconnect, openLogin, sessionLifetime, changeSessionLifetime }: PageProps) => <><div className="page-heading"><h1>{moteText("设置")}</h1><p>{moteText("调整服务与资料管理方式，或管理当前登录。")}</p></div><SettingsLanding onPage={onPage}/><AccountSettings api={api} disconnect={disconnect} onLogin={openLogin??disconnect}/></> },
];
