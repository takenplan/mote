import { moteText } from '@mote/shared/i18n';
import { ArrowRight, Database, FileText, FolderInput, Layers3, MessageSquare, Plus, Sparkles } from 'lucide-react';
import { answerPreview } from './AnswerMarkdown';
import { type Activity, type Answer, type Api, type Capture, type Device, type Range, type Status } from './api';
import { type Page } from './navigation';
import { CaptureCard } from './shell-components';
import { FeatureHome } from './features/home';
export function Overview({ api, status, devices, recent, insights, onPage, onOpen }: {
    api: Api;
    status: Status;
    devices: Device[];
    activity: Activity;
    recent: Capture[];
    insights: Answer[];
    onPage: (page: Page) => void;
    onOpen: (id: string) => void;
    range: Range;
    onMedia: () => void;
}) {
    const firstDevice = devices.length === 0;
    const needsSetup = firstDevice && status.storage.captures === 0;
    return <div className="home-page library-home">
  <section className="home-archive-intro" aria-labelledby="home-purpose">
    <div className="greeting"><div><div className="eyebrow">Mote / {moteText('个人资料库')}</div><h1 id="home-purpose">{moteText('你的记录，随时找回。')}</h1><p>{moteText("汇集手机、电脑、文件和录音中的记录；用自己的问题找答案，再回到原文核对。")}</p><div className="home-purpose-actions"><button className="button primary" onClick={() => onPage(status.storage.captures === 0 ? 'imports' : 'archive')}>{status.storage.captures === 0 ? <FolderInput size={17} aria-hidden="true"/> : <Database size={17} aria-hidden="true"/>}{status.storage.captures === 0 ? moteText('导入资料') : moteText('打开资料库')}<ArrowRight size={16}/></button><button className="text-button" onClick={() => onPage('featureGuide')}>{moteText("全部功能与设置")}<ArrowRight size={15}/></button></div></div></div>
    <nav className="home-retrieval" aria-label={moteText("用资料提问、记忆和回顾")}>
      <a href="#/ask"><MessageSquare size={19}/><span><strong>{moteText("问一问")}</strong><small>{moteText("找答案，再核对原文")}</small></span><ArrowRight size={16}/></a>
      <a href="#/library?view=memories"><Layers3 size={19}/><span><strong>{moteText("记忆")}</strong><small>{moteText("保留可更正的事实与偏好")}</small></span><ArrowRight size={16}/></a>
      <a href="#/library/insights"><Sparkles size={19}/><span><strong>{moteText("洞察")}</strong><small>{moteText("生成有证据的阶段回顾")}</small></span><ArrowRight size={16}/></a>
    </nav>
  </section>
  <section className="discovery-intake" aria-label={moteText("添加资料")}><div className="discovery-intake-heading"><div><h2>{moteText("添加资料")}</h2><p>{moteText("从新的想法到已有资料，选择你想汇集的内容。")}</p></div></div><div className="discovery-intake-grid">
    <button className="panel discovery-intake-card" onClick={() => onPage('sourceCatalog')}><Plus size={22}/><span><strong>{moteText("新增数据源")}</strong><small>{moteText("手机 / Mac、飞书录音、钉钉录音、邮件与日历")}</small></span><ArrowRight size={17}/></button>
    <button className="panel discovery-intake-card" onClick={() => onPage('imports')}><FolderInput size={22}/><span><strong>{moteText("导入资料")}</strong><small>{moteText("文件、ZIP、文件夹或服务器目录")}</small></span><ArrowRight size={17}/></button>
    <button className="panel discovery-intake-card" onClick={() => onPage('notes')}><FileText size={22}/><span><strong>{moteText("写随手记")}</strong><small>{moteText("写文字，或选择已有图片 / 音频附件")}</small></span><ArrowRight size={17}/></button>
  </div></section>
  {!needsSetup && <div className="home-library-layout"><section className="recent-section"><div className="section-heading"><div><h2>{moteText('最近同步的记录')}</h2><p>{moteText('先看内容，再回到完整资料与来源。')}</p></div><button className="text-button" onClick={() => onPage('archive')}>{moteText('查看全部')}<ArrowRight size={15}/></button></div>{recent.length ? <div className="home-record-list">{recent.slice(0, 4).map(capture => <CaptureCard compact key={capture.id} capture={capture} api={api} onOpen={onOpen}/>)}</div> : <div className="home-empty"><Layers3 size={23}/><p>{moteText('这里还没有近期屏幕记录。文件、随手记和其他资料可在资料库里查看。')}</p></div>}</section>
</div>}
  {insights[0] && <button className="home-insight" onClick={() => onPage('insights')}><Sparkles size={21}/><div><strong>{moteText('你最近的洞察')}</strong><p>{answerPreview(insights[0], 125)}</p><small>{insights[0].citations.length}{' '}{moteText('条证据来源')}</small></div><ArrowRight size={18}/></button>}
  <div className="discovery-workspace-hints"><button onClick={() => onPage('devices')}><strong>{moteText('{0} 台已知设备', devices.length)}</strong><small>{moteText('查看上次上报的采集与同步状态')}</small></button><button onClick={() => onPage('archive')}><strong>{moteText("资料库")}</strong><small>{moteText("原文、文件与录音、记忆、应用活动和媒体线索")}</small></button><button onClick={() => onPage('activity')}><strong>{moteText("Mote 后台工作")}</strong><small>{moteText("采集内容理解、导入、记忆处理的进展与需要处理事项")}</small></button><button onClick={() => onPage('about')}><strong>{moteText("设置")}</strong><small>{moteText("模型、处理方式、自动记忆、保存与备份、用量与维护")}</small></button></div>
  {!needsSetup && <div className="home-secondary"><button className="text-button" onClick={() => onPage('actions')}>{moteText('查看行动建议')}<ArrowRight size={15}/></button>{!status.agent.configured && <button className="text-button" onClick={() => onPage('settings')}>{moteText('配置问答模型')}<ArrowRight size={15}/></button>}</div>}
  {!needsSetup && <details className="home-extensions"><summary>{moteText('更多上下文视图')}</summary><FeatureHome api={api} onPage={onPage}/></details>}
 </div>;
}
