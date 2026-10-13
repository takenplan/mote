import {moteText} from '@mote/shared/i18n';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type {Api} from './api';
import {DiscoveryLink,DiscoveryProvider,useDiscoveryState} from './DiscoveryLink';
import { guideSections, quickLinks, type GuideTarget, type GuideUnit, type GuideGroup } from './feature-guide-catalog';
type GuideLinkProps = {
    target: GuideTarget;
    onPage: (page: string) => void;
    children?: ReactNode;
    primary?: boolean;
};
function GuideLink({target,children,primary=false}:GuideLinkProps){
 return <DiscoveryLink target={target} className={primary?'button guide-primary-link':'guide-text-link'} arrow><span>{children||moteText(target.label)}</span></DiscoveryLink>;
}
function Unit({ unit, onPage }: {
    unit: GuideUnit;
    onPage: (page: string) => void;
}) {
    const setupLinks = unit.setupTargets.filter((t, i, a) => a.findIndex(s => s.href === t.href && s.categoryId === t.categoryId) === i);
    return <section className="guide-unit" data-capability-id={unit.id}>
    <h4>{moteText(unit.title)}</h4>
    <p className="guide-unit-purpose">{moteText(unit.purpose)}</p>
    <p className="guide-path"><span>{moteText("入口")}</span>{moteText(unit.target.path)}</p>
    <p className="guide-where">{moteText(unit.target.where)}</p>
    <div className="guide-unit-links"><GuideLink target={unit.target} onPage={onPage}>{moteText("打开{0}",moteText(unit.target.label))}</GuideLink></div>
    <ul className="guide-actions">{unit.actions.map(action => <li key={moteText(action)}>{moteText(action)}</li>)}</ul>
    {unit.setup && <div className="guide-setup"><strong>{moteText("需要先设置")}</strong><p>{moteText(unit.setup)}</p>{setupLinks.length > 0 && <div className="guide-unit-links">{setupLinks.map((t, i) => <GuideLink key={t.href + String(t.categoryId) + i} target={t} onPage={onPage}>{moteText(t.label)}</GuideLink>)}</div>}</div>}
    {unit.condition && <p className="guide-condition"><strong>{moteText("何时出现")}</strong> {moteText(unit.condition)}</p>}
    {unit.caveats.length > 0 && <ul className="guide-notes">{unit.caveats.map(note => <li key={moteText(note)}>{moteText(note)}</li>)}</ul>}
    {unit.otherTargets.length > 0 && <details className="guide-related"><summary>{moteText("相关入口")}<ChevronDown size={13} aria-hidden="true"/></summary><div className="guide-unit-links">{unit.otherTargets.map((t, i) => <GuideLink key={t.href + String(t.categoryId) + i} target={t} onPage={onPage}>{moteText(t.label)}</GuideLink>)}</div></details>}
  </section>;
}
function Group({ group, onPage }: {
    group: GuideGroup;
    onPage: (page: string) => void;
}) {
    const core = group.units.filter(unit => unit.priority === 'core');
    const advanced = group.units.filter(unit => unit.priority === 'advanced');
    return <article className="panel guide-group" data-guide-group={group.id}>
    <div className="guide-group-heading"><h3>{moteText(group.title)}</h3><p>{moteText(group.purpose)}</p></div>
    <div className="guide-group-links">{group.links.map((t, i) => <GuideLink key={t.href + String(t.categoryId) + i} target={t} onPage={onPage} primary>{moteText(t.label)}</GuideLink>)}</div>
    <div className="guide-setting-note"><strong>{moteText("设置在哪里")}</strong><p>{moteText(group.setting)}</p></div>
    <details className="guide-group-details"><summary>{moteText("具体操作、设置与条件")}<ChevronDown size={16} aria-hidden="true"/></summary>
      <div className="guide-unit-list">{core.map(unit => <Unit key={unit.id} unit={unit} onPage={onPage}/>)}</div>
      {advanced.length > 0 && <details className="guide-advanced"><summary>{moteText("更多功能与高级设置")}<ChevronDown size={15} aria-hidden="true"/></summary><div className="guide-unit-list">{advanced.map(unit => <Unit key={unit.id} unit={unit} onPage={onPage}/>)}</div></details>}
    </details>
  </article>;
}
const modelConnectionStart: GuideTarget = { pageId: 'settings', href: '#/system/models?category=providers', collectionId: null, categoryId: 'providers', label: "模型连接（Provider）", path: "设置 → 模型与服务 → 模型连接（Provider）", where: '' };
const moduleStart: GuideTarget = { pageId: 'settings', href: '#/system/models?category=model', collectionId: null, categoryId: 'model', label: "模块与模型", path: "设置 → 模型与服务 → 模块与模型", where: '' };
/** This guide describes existing destinations. It never invokes product mutations. */
export function FeatureGuide({ api,onPage }: {
    api:Api;
    onPage: (page: string) => void;
}) {
    const state=useDiscoveryState(api);
    return <DiscoveryProvider state={state}><div className="feature-guide">
    <div className="page-heading guide-heading"><div className="eyebrow">{moteText("资料、证据与记忆")}</div><h1>{moteText("全部功能")}</h1><p>{moteText("从你想做的事找到入口。接入选中的资料，保留原始证据，再按需要提问、回顾和整理。")}</p></div>
    <nav className="guide-section-nav" aria-label={moteText("功能分类")}>{guideSections.map((section, index) => <button key={section.id} type="button" onClick={() => {
      const target = document.getElementById('guide-heading-' + section.id);
      target?.focus({preventScroll:true});
      document.getElementById('guide-section-' + section.id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }}><span className="guide-index-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span><strong>{moteText(section.title)}</strong><small>{moteText(section.description)}</small></span><ArrowRight size={16} aria-hidden="true"/></button>)}</nav>
    <section className="panel guide-start" aria-label={moteText("常用入口")}><div><h2>{moteText("开始一件事")}</h2><p>{moteText("记录想法、加入已有资料，或查看正在做的工作。")}</p></div><div className="guide-quick-links">{quickLinks.map(t => <GuideLink key={moteText(t.label)} target={t} onPage={onPage} primary>{moteText(t.label)}</GuideLink>)}</div></section>
    <aside className="guide-model-start" aria-labelledby="guide-model-start-title">
      <h2 id="guide-model-start-title">{moteText("准备使用 AI 功能？先检查这两处")}</h2>
      <p>{moteText("提问、理解资料或整理记忆前，可按这条路径检查。已有可用的默认连接与分配，可以直接回到原任务。")}</p>
      <ol className="guide-model-steps">
        <li><GuideLink target={modelConnectionStart} onPage={onPage}>{moteText("保存或检查模型连接")}</GuideLink><span>{moteText("地址、凭据和可用模型")}</span></li>
        <li><GuideLink target={moduleStart} onPage={onPage}>{moteText("检查或分配对应功能")}</GuideLink><span>{moteText("只检查这次要用的模块")}</span></li>
        <li><strong>{moteText("回到原任务继续")}</strong><span>{moteText("无需逐项修改所有模块")}</span></li>
      </ol>
      <details className="guide-model-terms"><summary>{moteText("模型连接、配方和方案各管什么？")}<ChevronDown size={14} aria-hidden="true"/></summary>
        <p><strong>{moteText("模型连接（Provider）")}</strong>{moteText("保存服务地址、凭据与可用模型；")}<strong>{moteText("模块与模型")}</strong>{moteText("决定对应功能使用哪个连接和模型。单次请求仍可按提供的入口选择模型。")}</p>
        <p><strong>{moteText("记忆配方")}</strong>{moteText("定义要整理什么输入、输出何种记忆；")}<strong>{moteText("记忆方案")}</strong>{moteText("是当前运行的整体实现，由可信组件和实例组成。并发、超时及其他执行参数在相应高级设置中按需调整。")}</p>
      </details>
    </aside>
    {guideSections.map(section => <section className="guide-section" key={section.id} id={'guide-section-' + section.id} aria-labelledby={'guide-heading-' + section.id}>
      <div className="guide-section-heading"><h2 tabIndex={-1} id={'guide-heading-' + section.id}>{moteText(section.title)}</h2><p>{moteText(section.description)}</p></div>
      <div className="guide-groups">{section.groups.map(group => <Group key={group.id} group={group} onPage={onPage}/>)}</div>
    </section>)}
    <div className="guide-footer"><p>{moteText("采集与系统权限在对应设备设置。原件归档、正文发布、索引和记忆各有状态，可在资料详情与活动中核对。")}</p><GuideLink target={{ pageId: 'activity', href: '#/activity', collectionId: null, categoryId: null, label: moteText("活动"), path: moteText("活动"), where: '' }} onPage={onPage}>{moteText("查看工作进度")}</GuideLink></div>
  </div></DiscoveryProvider>;
}
