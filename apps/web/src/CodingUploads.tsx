import { useState } from 'react';
import { moteText } from '@mote/shared/i18n';
import { type Api, bytes, errorMessage } from './api';
import { useResource } from './useResource';
type Upload = {
    source: {
        id: string;
        name: string;
        deviceId: string;
        enabled: boolean;
        status?: {
            state: string;
            lastSyncAt?: string;
        };
    };
    received: {
        events: number;
        lastObservedAt: string | null;
    };
    archiveBytes: number;
    materials: number;
    indexedMaterials: number;
    memory: {
        state: string;
        count: number;
    }[];
    work: {
        state: string;
        count: number;
    }[];
    pipeline: string | null;
};
function stateLabel(state: string) {
    const labels: Record<string, string> = { not_requested: moteText("未安排"), waiting: moteText("等待处理"), pending: moteText("等待处理"), queued: moteText("排队中"), running: moteText("处理中"), complete: moteText("已完成"), completed: moteText("已完成"), blocked: moteText("需要处理，查看具体原因"), failed: moteText("失败，需关注"), waiting_for_model: moteText("等待配置模型"), waiting_for_input: moteText("等待输入或澄清"), paused: moteText("已暂停"), pausing: moteText("当前批次结束后暂停"), cancelled: moteText("已取消"), stale: moteText("输入已变更"), invalidated: moteText("证据已失效"), disabled: moteText("未启用") };
    return moteText(labels[state] ?? '未知状态');
}
function counts(rows: {
    state: string;
    count: number;
}[], empty: string) { return rows.map(row => `${stateLabel(row.state)}: ${row.count}`).join(' · ') || empty; }
export function CodingUploads({ api, embedded = false }: {
    api: Api;
    embedded?: boolean;
}) {
    const Heading = embedded ? 'h3' : 'h1';
    const [offset, setOffset] = useState(0);
    const page = useResource<{
        items: Upload[];
        nextOffset: number | null;
    }>(api, `/api/coding/uploads?offset=${offset}&limit=20`, 5000);
    return <div className="coding-uploads" role={embedded?'region':undefined} aria-label={embedded?moteText('Coding 会话同步状态'):undefined} tabIndex={embedded?0:undefined}>
  <div className="page-heading"><Heading>{moteText("Coding 会话同步状态")}</Heading><p>{moteText("查看 Mac 客户端同步到中央节点的结果。增量事件接收、会话正文发布、索引与记忆分别推进；事件条数与会话份数不能直接比较。")}</p></div>
  <p className="notice">{moteText("接收成功或任务完成不代表源会话内容完整；请在会话正文中另行核对覆盖范围和缺片提示。")}</p>
  <div className="discovery-inline-guidance"><h3>{moteText("从 Mac 客户端接入")}</h3><p>{moteText("先安装 Mac 客户端并连接中央节点，再在客户端打开「来源 → 连接 Coding Agent」，选择本机实际存在的 Claude Code、Codex 或 Kimi 和采集范围，启动同步。这里查看同步状态；本机采集由客户端控制。")}</p><div className="processing-actions"><a className="text-button" href="https://github.com/utopiafar/mote/releases" target="_blank" rel="noreferrer">{moteText("下载 Mac 客户端 →")}</a><a className="text-button" href="#/connections/pair">{moteText("连接到中央节点 →")}</a>{!embedded && <a className="text-button" href="#/activity?coding=receipts">{moteText("在处理任务中查看接收状态 →")}</a>}</div><p>{moteText("已有文件、ZIP 和文件夹可使用「导入资料」。")} <a className="text-button" href="#/library/import">{moteText("导入资料 →")}</a></p></div>
  {page.error !== undefined && <p role="alert">{errorMessage(page.error)}</p>}
  {!page.data && page.loading && <p role="status">{moteText("正在读取同步状态…")}</p>}
  {page.data?.items.map(item => <article key={item.source.id} className="panel panel-pad"><h3>{item.source.name}</h3><p>{item.source.deviceId} · {item.source.enabled ? moteText('已启用') : moteText('已暂停')}</p><dl><dt>{moteText("已接收增量事件")}</dt><dd>{item.received.events}</dd><dt>{moteText('原件大小')}</dt><dd>{bytes(item.archiveBytes)}</dd><dt>{moteText("已发布会话")}</dt><dd>{item.materials}</dd><dt>{moteText("已索引会话")}</dt><dd>{item.indexedMaterials}</dd><dt>{moteText("会话正文处理")}</dt><dd>{counts(item.work, moteText("暂无处理任务"))}</dd><dt>{moteText('记忆整理')}</dt><dd>{counts(item.memory, moteText("未安排"))}</dd></dl><details><summary>{moteText("技术状态码")}</summary><p>{moteText("正文处理：")}{item.work.map(row => `${row.state}: ${row.count}`).join(' · ') || '—'}</p><p>{moteText("记忆整理：")}{item.memory.map(row => `${row.state}: ${row.count}`).join(' · ') || '—'}</p></details><a className="button" href={'#/library?view=materials&sourceId=' + encodeURIComponent(item.source.id)}>{moteText("查看此来源的会话正文")}</a></article>)}
  {page.data && !page.data.items.length && <p>{moteText("还没有收到 Coding 来源。按上方客户端步骤接入后，可在这里查看接收与处理结果。")}</p>}
  <div className="processing-actions">{offset > 0 && <button className="button" onClick={() => setOffset(0)}>{moteText('返回第一页')}</button>}{page.data?.nextOffset != null && <button className="button" onClick={() => setOffset(page.data!.nextOffset!)}>{moteText('下一页')}</button>}</div>
 </div>;
}
