import { formatEvidenceRef } from '@mote/shared';
import { ArchivedAudio } from './ArchivedAudio';
import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { moteText } from '@mote/shared/i18n';
import type { RecordingStatus, RecordingSelection } from '@mote/shared';
import { type Api, errorMessage } from './api';
import { useResource } from './useResource';
import { useHashChoice } from './useHashChoice';
const readProvider=(hash:string)=>new URLSearchParams(hash.slice(hash.indexOf('?')+1)).get('provider')??'';
const names: Record<string, string> = { feishu: '飞书录音 / 妙记', dingtalk: '钉钉录音 / 闪记' };
const phases: Record<string, string> = { discover: '发现记录', metadata: '读取信息', transcript: '归档转写', media: '备份音频' };
const states: Record<string, string> = { waiting: '等待处理', running: '正在处理…', succeeded: '已完成', failed: '未完成', blocked: '需要处理', cancelled: '已取消', stale: '已过期' };
const errors: Record<string, string> = {
    lark_cli_missing: '中央节点需要安装 Lark CLI 并完成飞书账号授权。',
    lark_not_connected: '请先在中央节点完成飞书账号授权，再连接录音。',
    dingtalk_cli_missing: '中央节点需要安装 DWS CLI 并完成钉钉账号授权。',
    dingtalk_not_connected: '请先在中央节点完成钉钉账号授权，再连接录音。',
    recording_account_changed: '账号已变化，请重新连接并确认同步范围。',
    recording_authorization_required: '读取权限不足或授权已失效，请重新连接后重试。',
    recording_transcript_not_ready: '厂商转写尚未就绪，将自动重试。',
    unsupported_format: '厂商转写格式尚不支持。音频备份是独立步骤，请分别核对转写与音频的状态。',
};
const problem = (code: string,phase?:string) => errors[code]&&(code!=='unsupported_format'||phase==='transcript')?moteText(errors[code]):moteText('同步未完成（原因代码：{0}）。请查看同步步骤，核对实际原因后再重试。',code);
const inputTime = (value?: string) => value ? new Date(Date.parse(value) - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
export function RecordingConnection({ api, provider, onOpen }: {
    api: Api;
    provider: string;
    onOpen: (ref: string) => void;
}) {
    const path = `/api/connectors/${provider}-recordings`, read = useResource<RecordingStatus>(api, path, 3000);
    const archive = useResource<{
        items: {
            captureId: string;
            title: string;
            audio?: {
                id: string;
                name: string;
                mimeType: string;
            };
        }[];
    }>(api, read.data?.connected ? path + '/items' : null, 10000);
    const [selection, setSelection] = useState<RecordingSelection>(), [error, setError] = useState(''), [busy, setBusy] = useState(false);
    const dirty = useRef(false), scope = useRef(new AbortController());
    useEffect(() => { const controller = new AbortController(); scope.current = controller; return () => controller.abort(); }, [api, provider]);
    useEffect(() => { if (read.data && !dirty.current)
        setSelection(read.data.selection); }, [read.data]);
    const update = (patch: Partial<RecordingSelection>) => { dirty.current = true; setSelection(v => v ? { ...v, ...patch } : v); };
    const run = async (method: string, suffix = '', body?: unknown) => { const signal = scope.current.signal; setBusy(true); setError(''); try {
        const next = await api.request<RecordingStatus>(path + suffix, { method, signal, ...(body ? { body: JSON.stringify(body) } : {}) });
        if (!signal.aborted) {
            dirty.current = false;
            setSelection(next.selection);
            read.refresh();
        }
    }
    catch (e) {
        if (!signal.aborted)
            setError(e instanceof Error && Object.hasOwn(errors,e.message) ? problem(e.message) : errorMessage(e));
    }
    finally {
        if (!signal.aborted)
            setBusy(false);
    } };
    const status = read.data;
    return <section className="panel lark-step"><div className="section-heading"><h2>{names[provider]?moteText(names[provider]):status?.label ?? provider}</h2><span className={`badge ${status?.connected ? 'green' : 'muted'}`}>{status?.connected ? moteText('已连接') : moteText('尚未授权')}</span></div>
 {Boolean(error || read.error) && <p role="alert" className="notice error">{error || errorMessage(read.error)}</p>}
 {status?.accountName && <p>{status.accountName}</p>}{!status?.connected && <div className="discovery-inline-guidance"><p>{moteText("先在中央节点授权厂商账号，确认所需读取权限，再选择历史范围并启用同步。飞书文档与日历的授权另在自己的页面管理。")}</p></div>}
 {!status?.connected && <><p>{moteText('连接中央节点已经授权的厂商账号，然后选择首次导入时间。')}</p><button className="button" disabled={busy || !status} onClick={() => void run('POST', '/connect')}>{moteText('连接已授权账号')}</button>
 {(provider === 'feishu' || provider === 'dingtalk') && <details><summary>{moteText('首次授权帮助')}</summary>{provider === 'feishu' ? <><p>{moteText('在中央节点安装并登录官方 Lark CLI。需要妙记搜索、基础信息、产物读取和媒体导出权限。')}</p><code>lark-cli auth login</code><p><a href="https://github.com/larksuite/cli" target="_blank" rel="noreferrer">Lark CLI</a></p></> : <><p>{moteText('在中央节点安装并登录官方 DWS CLI；所在组织需开启 CLI 接入。钉钉适配器尚未完成真实账号验证。')}</p><code>dws auth login</code><p><a href="https://github.com/DingTalk-Real-AI/dingtalk-workspace-cli" target="_blank" rel="noreferrer">DWS CLI</a></p></>}</details>}{status?.setup && <details><summary>{moteText('首次授权帮助')}</summary><p>{status.setup.description}</p>{status.setup.command && <code>{status.setup.command}</code>}{status.setup.documentationUrl?.startsWith('https://') && <p><a href={status.setup.documentationUrl} target="_blank" rel="noreferrer">{status.label ?? provider}</a></p>}</details>}</>}
 {status?.connected && selection && <><fieldset disabled={busy}><div className="lark-range"><label>{moteText('首次历史导入起点')}<input type="datetime-local" required value={inputTime(selection.start)} onChange={e => { if (e.target.value)
            update({ start: new Date(e.target.value).toISOString() }); }}/></label><label>{moteText('导入终点（留空持续同步）')}<input type="datetime-local" value={inputTime(selection.end)} onChange={e => update({ end: e.target.value ? new Date(e.target.value).toISOString() : undefined })}/></label></div>
 <label className="lark-check"><input type="checkbox" checked={selection.enabled} onChange={e => update({ enabled: e.target.checked })}/>{moteText('启用录音同步')}</label><label className="lark-check"><input type="checkbox" checked={selection.autoSync} onChange={e => update({ autoSync: e.target.checked })}/>{moteText('在后台定期同步选中内容')}</label>
 <div className="lark-buttons"><button className="button" onClick={() => void run('PUT', '/selection', selection)}>{moteText('保存并开始同步')}</button><button className="button subtle" disabled={!selection.enabled || dirty.current} onClick={() => void run('POST', '/sync')}><RefreshCw size={15}/>{moteText('立即同步')}</button><button className="button subtle" disabled={!status.counts.failed} onClick={() => void run('POST', '/retry')}>{moteText('重试失败步骤')}</button><button className="button subtle" onClick={() => void run('DELETE')}>{moteText('断开连接')}</button></div></fieldset></>}
 {status && <><p role="status">{moteText('已归档转写 {0} 条，音频 {1} 条；等待 {2} 步，需处理 {3} 步。', status.counts.transcripts, status.counts.audio, status.counts.pending, status.counts.failed)}</p>
 {status.counts.failed > 0 && <p className="notice error" role="alert">{status.counts.failed}{moteText("个步骤需要处理。")}{Array.from(new Set(status.steps.filter(step => step.error).map(step => problem(step.error!,step.phase)))).slice(0, 3).join(' ')}{moteText("核对原因后，可使用上方「重试失败步骤」。转写与音频状态分别核对。")}</p>}<details className="discovery-bounded-details"><summary>{moteText('同步步骤与状态')} · {status.steps.length}{moteText("项")}</summary><div className="discovery-bounded-list" role="region" aria-label={moteText("同步步骤与状态明细")} tabIndex={0}>{status.steps.map(step => <p key={step.id}>{phases[step.phase]?moteText(phases[step.phase]):step.phase} · {states[step.state]?moteText(states[step.state]):step.state} · {moteText('尝试 {0} 次', step.attempts)}{step.error && <> · {problem(step.error,step.phase)} <code className="discovery-technical-id">{step.error}</code></>}</p>)}</div></details></>}
 {Boolean(archive.data?.items.length) && <details className="discovery-bounded-details"><summary>{moteText('最近归档的录音')} · {archive.data!.items.length}{moteText("条")}</summary><div className="discovery-bounded-list" role="region" aria-label={moteText("最近归档的录音列表")} tabIndex={0}>{archive.data!.items.map(item => <div className="source-item" key={item.captureId}><button className="text-button" onClick={() => onOpen(formatEvidenceRef('capture', item.captureId))}>{item.title || moteText('原始录音')}</button>{item.audio && <ArchivedAudio api={api} id={item.audio.id} name={item.audio.name} mimeType={item.audio.mimeType}/>}</div>)}</div></details>}
 </section>;
}
export function RecordingsSettings({ api, onSources, onOpen, onAdd }: {
    api: Api;
    onSources: () => void;
    onOpen: (ref: string) => void;
    onAdd?: () => void;
}) {
    const registry = useResource<Record<string, RecordingStatus>>(api, '/api/connectors/status');
    const providers = Object.values(registry.data ?? {}).filter(status => status?.category === 'recordings');
    const [selected]=useHashChoice('provider',readProvider);
    const chosen = providers.find(status => status.provider === selected);
    return <div className="lark-settings">{onAdd && <button className="back-link" onClick={onAdd}>{moteText("← 返回数据源目录")}</button>}<div className="page-heading"><h1>{chosen ? names[chosen.provider]?moteText(names[chosen.provider]):chosen.label ?? chosen.provider : moteText('录音归档')}</h1><p>{moteText('照常使用录音笔。厂商完成上传和转写后，Mote 自动归档并生成可追溯的 Memory。')}</p></div><div className="lark-boundary"><p>{moteText('默认用转写生成洞察，原始音频在后台备份。厂商端删除后，Mote 归档继续保留。停止同步或断开连接会保留历史资料。')}</p></div><div className="discovery-recorder-steps"><span><b>1</b>{moteText("准备厂商账号与读取授权")}</span><span><b>2</b>{moteText("确认历史范围并启用同步")}</span><span><b>3</b>{moteText("查看转写归档与音频备份状态")}</span></div>{Boolean(registry.error) && <p role="alert">{errorMessage(registry.error)}</p>}
 {chosen ? <RecordingConnection key={chosen.provider} api={api} provider={chosen.provider} onOpen={onOpen}/> : <><div className="discovery-source-grid">{providers.map(status => <a className="panel discovery-source-card" key={status.provider} href={'#/connections/recordings?provider=' + encodeURIComponent(status.provider)}><h2>{names[status.provider]?moteText(names[status.provider]):status.label ?? status.provider}</h2><p>{status.connected ? moteText("已连接，查看范围和同步状态") : moteText("尚未接入，查看首次授权和同步设置")}</p><span className="discovery-card-action">{moteText("打开此录音来源 →")}</span></a>)}</div>{selected && registry.data && <p role="status">{moteText("该录音来源当前未注册。请重新选择可用来源；已归档资料仍可从资料库查看。")}</p>}</>}
 <button className="button subtle" onClick={onSources}>{moteText('查看来源与归档')}</button></div>;
}
