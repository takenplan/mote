import {it, expect} from 'vitest';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DurableQueue} from '../src/queue';
import {defaultConfig} from '../src/config';
import {localContentDetail} from '../src/content-library';

it('reads a real compacted activity original without claiming a saved image or pending parsing', async () => {
  const directory=await mkdtemp(join(tmpdir(),'mote-activity-reader-'));
  try {
    const config={...defaultConfig(),deviceName:'Generated Mac'},queue=new DurableQueue(directory,config);
    await queue.initialize();
    const id=randomUUID(),first={id,deviceId:config.deviceId,deviceName:config.deviceName,platform:'macos' as const,source:'activity' as const,appId:'dev.mote.generated',appName:'Generated activity',capturedAt:'2026-10-30T01:00:00.000Z',durationMs:0,privacy:{excluded:false as const,redacted:false,mode:'none' as const,collection:'activity' as const}};
    await queue.enqueue(first);
    await queue.enqueue({...first,id:randomUUID(),capturedAt:'2026-10-30T01:00:15.000Z',durationMs:15000});
    const stored=queue.recordForHistory(id)!;
    expect(stored.event.stateSeries?.samples).toHaveLength(2);
    const detail=await localContentDetail(queue,{} as never,'queue:'+id);
    expect(detail.text).toBe('仅记录应用活动；未采集屏幕、窗口标题或正文');
    expect(detail.text).not.toMatch(/解析|识别|原件已保存在本机/);
    expect(detail.hasImage).toBe(false);
    expect(detail.retainsOriginal).toBeUndefined();
    expect(JSON.parse(detail.metadata).stateSeries).toEqual(stored.event.stateSeries);
    expect(JSON.parse(detail.metadata).durationMs).toBe(first.durationMs);
    expect(stored.event).not.toHaveProperty('ocrText');
  } finally { await rm(directory,{recursive:true,force:true}); }
});
