import { moteText } from '@mote/shared/i18n';
import {useSyncExternalStore} from 'react';
import { ArrowLeft, ArrowRight, Settings2 } from 'lucide-react';
import { webFeatures } from './features/registry';
import { LanguageSelector } from './LanguageSelector';
import { pageLabels, sectionFor, sections, type Page } from './navigation';
export function primaryDestination(page: Page) {
    if(page==='featureGuide')return 'overview';
    if(page==='coding')return 'archive';
    const section = sectionFor(page);
    if (section === 'library')
        return 'archive';
    if (section === 'connections')
        return 'devices';
    if (page === 'processing')
        return 'activity';
    if (page === 'actions')
        return 'overview';
    return ['overview', 'archive', 'ask', 'activity', 'devices'].includes(page) ? page : 'about';
}
/** Settings keep their task controls; the complete feature directory remains a discovery surface. */
export function isSettingsContext(page: Page) {
    return page !== 'featureGuide' && (primaryDestination(page) === 'about' || ['lark', 'recordings'].includes(page));
}
export function parentDestination(page:Page):Page|undefined {
    if(page==='featureGuide')return 'overview';
    if(page==='coding')return 'archive';
    const section=sectionFor(page);
    if(section==='library'&&page!=='archive')return 'archive';
    if(section==='connections'&&page!=='devices')return 'devices';
    if(page==='settings')return;
    if(page==='processing')return 'activity';
    if(page==='actions')return 'overview';
    if(primaryDestination(page)==='about'&&page!=='about')return 'about';
}
export function WorkspaceNavigation({ page, onPage }: {
    page: Page;
    onPage: (page: Page) => void;
}) {
    const section = sectionFor(page);
    if (section === 'library') {
        const tools = sections.library.filter(id => id !== 'archive');
        return <div className="workspace-context">
      {page !== 'archive' && <button className="back-link" aria-label={moteText('返回{0}', pageLabels.archive)} onClick={() => onPage('archive')}><ArrowLeft size={16}/>{moteText('返回上级')}</button>}
      <label className="workspace-tool-select"><span>{moteText('资料库工具')}</span><select aria-label={moteText('资料库工具')} value={tools.includes(page) ? page : ''} onChange={event => { if (event.target.value)
            onPage(event.target.value); }}><option value="">{moteText('选择工具')}</option>{tools.map(id => <option value={id} key={id}>{pageLabels[id]}</option>)}</select></label>
    </div>;
    }
    if (section === 'connections') {
        const tools = sections.connections.filter(id => id !== 'devices');
        return <div className="workspace-context">
      {page !== 'devices' && <button className="back-link" aria-label={moteText('返回{0}', pageLabels.devices)} onClick={() => onPage('devices')}><ArrowLeft size={16}/>{moteText('返回上级')}</button>}
      <label className="workspace-tool-select"><span>{moteText('来源与连接')}</span><select aria-label={moteText('来源与连接')} value={tools.includes(page) ? page : ''} onChange={event => { if (event.target.value)
            onPage(event.target.value); }}><option value="">{moteText('管理来源或授权')}</option>{tools.map(id => <option value={id} key={id}>{pageLabels[id]}</option>)}</select></label>
    </div>;
    }
    // The models page owns its nested categories and their single parent control.
    if (page === 'settings')
        return null;
    if (page === 'featureGuide')
        return <button className="back-link workspace-back" aria-label={moteText('返回{0}',pageLabels.overview)} onClick={()=>onPage('overview')}><ArrowLeft size={16}/>{moteText('返回{0}',pageLabels.overview)}</button>;
    const parent=parentDestination(page);
    return parent?<button className="back-link workspace-back" aria-label={moteText('返回{0}',pageLabels[parent])} onClick={()=>onPage(parent)}><ArrowLeft size={16}/>{moteText('返回上级')}</button>:null;
}
export function SettingsLanding({ onPage }: {
    onPage: (page: Page) => void;
}) {
    useSyncExternalStore(webFeatures.registry.subscribe,webFeatures.registry.getRevision,webFeatures.registry.getRevision);
    const cards = [
        { id: 'settings', title: moteText("模型与服务"), description: moteText("连接模型服务，为问答、导入、记忆和洞察分配模型；调整图片、文件与语音处理。") },
        { id: 'extensions', title: moteText("自动记忆与插件"), description: moteText("暂停 / 恢复自动记忆、查看当前方案；预览并安装可信插件。") },
        { id: 'vault', title: moteText("存储、加密与备份"), description: moteText("查看保存方式；导出或恢复归档，管理内容加密与检索索引。") },
        { id: 'usage', title: moteText("用量与费用"), description: moteText("查看各功能的实际模型用量、费用记录与估算边界。") },
        { id: 'statistics', title: moteText("运行状态与空间"), description: moteText("按文件类型和最后修改日期查看中央节点的实际磁盘占用。") },
        { id: 'developer', title: moteText("诊断与更新"), description: moteText("查看脱敏日志和版本，导出问题诊断；检查高级部署配置。") },
        { id: 'agentView', title: moteText("Agent 能看到什么"), description: moteText("查看可访问资料目录、首次上下文与实际读取记录。") },
        { id: 'help', title: moteText("帮助与反馈"), description: moteText("排查连接、授权和处理问题，提交问题反馈。") },
    ];
    const known = new Set(cards.map(card => card.id));
    const extra = webFeatures.pages().filter(entry => (entry.section === 'system' || !entry.section) && !known.has(entry.id) && !new Set(['overview', 'ask', 'actions', 'activity', 'processing', 'about', 'featureGuide','coding']).has(entry.id));
    return <section className="settings-destinations"><div className="settings-toolbar"><LanguageSelector /><button className="text-button" onClick={() => onPage('featureGuide')}>{moteText("全部功能")}<ArrowRight size={15}/></button></div><p className="settings-scope">{moteText("采集范围在设备本机；中央节点负责归档、理解、检索和资料管理。")}</p><div className="settings-link-grid discovery-settings-grid">{cards.map(card => <button key={card.id} disabled={!webFeatures.page(card.id)} onClick={() => onPage(card.id)}><Settings2 size={18}/><span><strong>{card.title}</strong><small>{card.description}</small>{!webFeatures.page(card.id)&&<small>{moteText("当前服务未提供此入口")}</small>}</span><ArrowRight size={16}/></button>)}{extra.map(entry => <button key={entry.id} onClick={() => onPage(entry.id)}><Settings2 size={18}/><span><strong>{entry.label}</strong><small>{moteText("打开此功能查看状态与操作。")}</small></span><ArrowRight size={16}/></button>)}</div><details className="panel discovery-settings-boundary"><summary>{moteText("记忆设置分两处，各管什么？")}</summary><p><strong>{moteText("模型与服务 → 模块与模型")}</strong>{moteText("：选择模型、自动配方和历史资料的处理节奏。")}</p><p><strong>{moteText("自动记忆与插件 → 记忆方案")}</strong>{moteText("：暂停 / 恢复自动记忆，查看或准备更换当前方案。更换方案需先准备，再确认生效。")}</p></details></section>;
}
