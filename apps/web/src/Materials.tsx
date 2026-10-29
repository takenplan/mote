import {originalReferenceRoute,rememberOriginalReturn} from './ask-original-reference';
import {confirmNavigation} from './unsaved';
import { useState } from 'react';
import { moteText } from '@mote/shared/i18n';
import { type Api, ApiError, errorMessage,dateTime } from './api';
import { useResource } from './useResource';
import type { LibraryCatalogDescriptor } from '@mote/shared';
import { FeatureActions, FeaturePanels, FeatureView } from './features/runtime';
import { AnswerMarkdown } from './AnswerMarkdown';
import { AttributionEditor, AttributionSummary, type AttributionContext } from './AttributionContext';
import { memoryMaterialRoute } from './memory-source-route';
import { artifactDisplay, materialKind, materialState, sourceDisplay } from './material-presentation';
export type Material = {
    id: string;
    ref: string;
    revision: string;
    kind: string;
    schemaVersion: number;
    title: string;
    sequence: number;
    textLength: number;
    blockCount: number;
    coverage: {
        state: string;
        reason?: string;
    };
    origin: {
        sourceId: string;
        provider?: string;
        sessionId?: string;
        deviceId?: string;
        firstAt?: string;
        lastAt?: string;
    };
    createdAt?: string;
    updatedAt?: string;
    artifacts?: {
        key: string;
        state: string;
        reason?: string;
    }[];
    indexing?: {
        state: 'disabled' | 'pending' | 'running' | 'indexed' | 'failed';
        reason?: string;
    };
    retention: {
        original: string;
    };
    attributionContext?: AttributionContext;
    memorySource?: {
        status: 'ready' | 'waiting' | 'unavailable' | 'too_large';
        evidenceIds: string[];
    };
};
type ReadPage = {
    material: Material;
    text: string;
    textRange: {
        offset: number;
        total: number;
        nextOffset: number | null;
    };
};
type Scope = {
    deviceId?: string;
    after?: string;
    before?: string;
};
export function MaterialDetail({ api, material, onOpen, agent = false, scope = {} }: {
    api: Api;
    material: Material;
    onOpen: (ref: string) => void;
    agent?: boolean;
    scope?: Scope;
}) {
    const [offset, setOffset] = useState(0), [tab, setTab] = useState('body'),[memberOffset,setMemberOffset]=useState(0), [indexBusy, setIndexBusy] = useState(false), [indexError, setIndexError] = useState('');
    // Each range is pinned to the selected revision. Identity is also the React key.
    const scopeQuery = new URLSearchParams(scope).toString();
    const read = useResource<ReadPage>(api, agent ? `/api/agent-view/material-read?ref=${encodeURIComponent(material.ref)}&offset=${offset}&${scopeQuery}` : `/api/materials/${encodeURIComponent(material.id)}/read?revision=${material.revision}&offset=${offset}&length=4000`, 5000);
    const current = useResource<Material>(api, agent ? null : `/api/materials/${encodeURIComponent(material.id)}`, 5000);
    const members = useResource<{
        items: {
            id: string;
            kind: string;
            ref: string;
        }[];
        nextOffset: number | null;
    }>(api, !agent && tab === 'origin' ? `/api/materials/${encodeURIComponent(material.id)}/members?revision=${material.revision}&offset=${memberOffset}&limit=20` : null);
    const sourceNames = useResource<{
        items: {
            id: string;
            name: string;
        }[];
    }>(api, !agent && tab === 'origin' ? '/api/sources' : null);
    const presentation = useResource<LibraryCatalogDescriptor>(api, agent ? null : '/api/library/descriptor', 5000);
    const selected = current.error === undefined && current.data?.revision === material.revision ? current.data : read.error === undefined ? read.data?.material ?? material : material;
    const rebuilding = selected.coverage.reason === 'source_evidence_changed' || read.error instanceof ApiError && read.error.status === 409;
    const historical = current.error === undefined && current.data && current.data.revision !== material.revision;
    const memorySource = !agent && !historical && current.error === undefined && current.data?.ref === material.ref ? current.data.memorySource : undefined;
    const catalog = (presentation.data?.schemaVersion === 1 && Array.isArray(presentation.data.types) ? presentation.data.types : []).find(type => type.kind === selected.kind && type.schemaVersion === selected.schemaVersion);
    const retry = () => { read.refresh(); current.refresh(); };
    const retryIndex = async () => { setIndexBusy(true); setIndexError(''); try {
        await api.request(`/api/materials/${encodeURIComponent(material.id)}/index/retry`, { method: 'POST' });
        retry();
    }
    catch (error) {
        setIndexError(errorMessage(error));
    }
    finally {
        setIndexBusy(false);
    } };
    return <article className="panel panel-pad material-detail">{!agent&&memorySource?.status==='ready'&&selected.coverage.state==='complete'&&<a className="button material-reader-ask" href={originalReferenceRoute('material',selected.ref)} onClick={event=>{if(!confirmNavigation()){event.preventDefault();return;}rememberOriginalReturn(api,'material',selected.ref);}}>{moteText('问问 AI')} ↗</a>}<h2>{selected.title}</h2><p>{materialKind(selected.kind, catalog?.label)} · {sourceDisplay(selected.origin.sourceId)}{(selected.origin.lastAt??selected.origin.firstAt)&&<> · {dateTime((selected.origin.lastAt??selected.origin.firstAt)!)}</>}</p>
    {['pending', 'running'].includes(selected.indexing?.state ?? '') && <p role="status">{moteText('资料已发布，检索索引正在处理中。')}</p>}
    {selected.indexing?.state === 'failed' && <p role="status">{moteText('检索索引未完成，正文可正常查看。')}{!agent && !historical && current.error === undefined && current.data?.ref === material.ref && <button className="button" disabled={indexBusy} onClick={() => void retryIndex()}>{moteText('仅重试检索索引')}</button>}</p>}
    {indexError && <p role="alert">{indexError}</p>}
    {historical && <p role="status">{moteText('这是历史版本，当前资料已更新。')} <button className="button" onClick={() => onOpen(current.data!.ref)}>{moteText('查看当前版本')}</button></p>}
    {rebuilding ? <p role="status">{moteText('来源已更正，正在重新整理资料。完成后可继续查看。')} <button onClick={retry}>{moteText('刷新')}</button></p> : read.error !== undefined && <p role="alert">{errorMessage(read.error)} <button onClick={retry}>{moteText('重试')}</button></p>}
    {current.error !== undefined && <p role="alert">{errorMessage(current.error)} <button onClick={retry}>{moteText('重试')}</button></p>}
    {!rebuilding && read.error === undefined && current.error === undefined && read.data && <FeatureView catalog={catalog} api={api} onOpen={onOpen} value={{ ...selected, representation: agent ? 'markdown' : 'owner-material', text: read.data.text }} fallback={<><AnswerMarkdown onOpen={onOpen} answer={{ answer: read.data.text, runId: selected.ref, trace: [], citations: [] }}/><p className="fine-print">{moteText('从第 {0} 个字符开始', offset + 1)} · {read.data.textRange.total}</p><div className="processing-actions">{offset > 0 && <button className="button" onClick={() => setOffset(0)}>{moteText('返回第一页')}</button>}{read.data.textRange.nextOffset !== null && <button className="button" onClick={() => setOffset(read.data!.textRange.nextOffset!)}>{moteText('继续展开')}</button>}</div></>}/>}
    {!agent && <FeatureActions position="detail" catalog={catalog} api={api} onOpen={onOpen} value={{ ...selected, representation: 'owner-material', text: read.data?.text ?? '' }}/>}
    <div className="reader-source-details"><button className="text-button" aria-expanded={tab==='origin'} onClick={()=>{setTab(tab==='origin'?'body':'origin');setMemberOffset(0);}}>{moteText('来源与处理')}</button>{tab === 'origin' && <>    {memorySource?.status === 'ready' && <a className="button" href={memoryMaterialRoute(selected.ref)}>{moteText('仅从这份正式资料提取记忆')}</a>}
    {memorySource && memorySource.status !== 'ready' && <p role="status">{moteText('这份正式资料暂不能单独提取记忆，请查看来源与处理状态。')}</p>}
<AttributionSummary context={selected.attributionContext}/>{!agent && !historical && current.error === undefined && current.data?.ref === material.ref && <><FeaturePanels api={api} onOpen={onOpen} value={{ kind: 'mote.material.context', schemaVersion: 1, representation: 'source-context', ref: selected.ref, revision: selected.revision, title: selected.title, text: '' }}/><AttributionEditor key={selected.ref} api={api} path={`/api/materials/${encodeURIComponent(selected.id)}/context`} revision={selected.revision} value={selected.attributionContext?.correction?.ownerRelation} onSaved={result => onOpen(result.ref)}/></>}{!agent&&<div className="source-toolbar"><a className="button subtle" href={'#/connections?sourceId='+encodeURIComponent(selected.origin.sourceId)}>{moteText('管理来源')}</a><a className="button subtle" href={'#/activity?materialId='+encodeURIComponent(selected.id)}>{moteText('相关活动')}</a></div>}<dl className="discovery-material-facts"><dt>{moteText('来源')}</dt><dd>{sourceDisplay(selected.origin.sourceId, sourceNames.data?.items?.find(source => source.id === selected.origin.sourceId)?.name)}</dd><dt>{moteText('原始记录')}</dt><dd>{materialState(selected.retention.original)}</dd><dt>{moteText('覆盖状态')}</dt><dd>{materialState(selected.coverage.state)}</dd></dl>{selected.coverage.state !== 'complete' && <p role="status">{moteText("资料范围尚不完整或仍在整理。请核对已有正文；缺失部分不能作为已经读取的证据。")}</p>}<details><summary>{moteText("技术标识与状态原因")}</summary><div className="discovery-technical-id"><p>{moteText("来源 ID：")}{selected.origin.sourceId}</p><p>{moteText("类型：")}{selected.kind} · {selected.coverage.state} · {selected.retention.original}</p><p>{moteText("覆盖原因：")}{selected.coverage.reason ?? '—'}</p></div></details><h3>{moteText('已记录的处理产物')}</h3>{selected.artifacts?.map(a => <div key={a.key}><p>{artifactDisplay(a.key)} · {materialState(a.state)}</p><details><summary>{moteText("查看产物标识与状态原因")}</summary><code className="discovery-technical-id">{a.key} · {a.state} · {a.reason ?? '—'}</code></details></div>)}{!agent && <><h3>{moteText('来源与定位')}</h3>{members.error !== undefined && <p role="alert">{errorMessage(members.error)}</p>}{members.data?.items.map(m => <p key={m.id}>{m.kind==='capture'&&<button className="text-button" onClick={()=>onOpen(m.ref)}>{moteText('查看原始记录')}</button>}<code>{m.kind} · {m.ref}</code></p>)}{members.data?.nextOffset != null && <button className="button" onClick={() => setMemberOffset(members.data!.nextOffset!)}>{moteText('下一页')}</button>}</>}</>}</div>
  </article>;
}
export function Materials({ api, onOpen, kind, sourceId, agent = false, scope = {} }: {
    api: Api;
    onOpen: (ref: string) => void;
    kind?: string;
    sourceId?: string;
    agent?: boolean;
    scope?: Scope;
}) {
    const [cursor, setCursor] = useState<string>(), [selected, setSelected] = useState<Material>();
    const query = new URLSearchParams({ limit: '12', ...(cursor ? { cursor } : {}), ...(kind ? { kind } : {}), ...(sourceId ? { sourceId } : {}), ...scope });
    const page = useResource<{
        items: Material[];
        nextCursor: string | null;
    }>(api, (agent ? '/api/agent-view/materials' : '/api/materials') + '?' + query);
    return <section className="materials-browser"><div className="page-heading"><h1>{moteText('正式资料')}</h1><p>{moteText('查看中央端发布的正文、版本、来源和处理产物。')}</p></div><button className="button" onClick={() => { setSelected(undefined); page.refresh(); }}>{moteText('刷新')}</button>{page.error !== undefined && <p role="alert">{errorMessage(page.error)}</p>}{page.loading && !page.data && <p role="status">{moteText('正在读取…')}</p>}
    {page.data && <><div className="feature-cards">{page.data.items.map(m => <button className="panel source-item" key={m.ref} onClick={() => setSelected(m)}><strong>{m.title}</strong><p>{materialKind(m.kind)} · {materialState(m.coverage.state)} · {m.textLength}{' '}{moteText("字符")}</p></button>)}</div>{!page.data.items.length && <p>{moteText('当前范围内暂无已发布资料。')}</p>}<div className="processing-actions">{cursor && <button className="button" onClick={() => { setCursor(undefined); setSelected(undefined); }}>{moteText('返回第一页')}</button>}{page.data.nextCursor && <button className="button" onClick={() => { setCursor(page.data!.nextCursor!); setSelected(undefined); }}>{moteText('下一页')}</button>}</div></>}
    {selected && page.error === undefined && <MaterialDetail key={selected.ref} api={api} material={selected} onOpen={onOpen} agent={agent} scope={scope}/>}
  </section>;
}
