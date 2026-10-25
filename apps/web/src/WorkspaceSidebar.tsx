import { Activity, Database, LayoutDashboard, Link2, Bot, MessageSquare, Settings2, Grid2X2 } from 'lucide-react';
import { moteText } from '@mote/shared/i18n';
import type { UiLayoutProfile } from '@mote/shared';
import type { Connection } from './api';
import { LanguageSelector } from './LanguageSelector';
import { primaryDestination } from './WorkspaceNavigation';

const destinations = {
  home: { page: 'overview', label: '总览', icon: LayoutDashboard },
  library: { page: 'archive', label: '资料库', icon: Database },
  sources: { page: 'sources', label: '数据来源', icon: Link2 },
  connections: { page: 'connections', label: 'AI 接入', icon: Bot },
  ask: { page: 'ask', label: '提问', icon: MessageSquare },
  activity: { page: 'activity', label: '活动', icon: Activity },
};

export function WorkspaceSidebar({ layout, page, onPage, connection, verified, profile, onConnect }: {
  layout: UiLayoutProfile;
  page: string;
  onPage: (page: string) => void;
  connection: Connection | null;
  verified: boolean;
  profile?: string;
  onConnect: () => void;
}) {
  return <aside id="primary-navigation" className="sidebar">
    <button className="brand" onClick={() => onPage('overview')} aria-label={moteText('总览')}><span className="mote-symbol">m</span><span>Mote<span className="brand-dot">.</span></span></button>
    <div className="workspace-label">{moteText('个人上下文中心')}</div>
    <nav aria-label={moteText('主导航')}>
      {layout.primary.map(id => {
        const item=destinations[id], Icon = item.icon, active = primaryDestination(page) === item.page;
        return <button key={item.page} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} onClick={() => onPage(item.page)}><Icon size={18} strokeWidth={1.7}/><span>{moteText(item.label)}</span></button>;
      })}
    </nav>
    <div className="sidebar-bottom">
      <button className="auxiliary-nav" aria-current={page === 'featureGuide' ? 'page' : undefined} onClick={() => onPage('featureGuide')}><Grid2X2 size={16}/>{moteText('全部功能')}</button>
      <button className="settings-nav" aria-current={primaryDestination(page) === 'about' ? 'page' : undefined} onClick={() => onPage('about')}><Settings2 size={16}/>{moteText('设置')}</button>
      <LanguageSelector/>
      <button className="node-button" onClick={() => connection ? onPage('about') : onConnect()}><span className={`node-state ${verified ? 'online' : ''}`}/><span><strong>{verified ? moteText('已登录 · {0}', profile || moteText('当前节点')) : connection ? moteText('正在验证登录') : moteText('登录 Mote')}</strong><small>{verified ? moteText('管理当前节点') : moteText('使用管理令牌访问资料')}</small></span></button>
    </div>
  </aside>;
}
