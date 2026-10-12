import {moteText} from '@mote/shared/i18n';
/** Exact host protocol values, without inferring the reason from content. */
const names: Record<string, string> = { not_installed: '尚未安装', model_missing: '所需本地模型未安装', model_unconfigured: '模型连接尚未配置', model_not_configured: '模型连接尚未配置', blocked: '需要处理，查看具体原因', waiting: '等待处理', pending: '等待处理', queued: '排队等待', running: '处理中', ready: '已就绪', downloading: '下载中', verifying: '校验中', installing: '安装中', failed: '处理失败', succeeded: '已完成', completed: '已完成', disabled: '未安排', cancelled: '已取消', stale: '资料变化，待重新核对', unknown: '状态尚未确认' };
export function processingState(state?:string){return moteText(state===undefined?'读取中':names[state]??'状态尚未识别');}
export function localModelState(state?: string) { return state === 'ready' ? moteText("模型文件已安装") : processingState(state); }
