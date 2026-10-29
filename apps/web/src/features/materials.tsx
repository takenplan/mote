import { moteText } from '@mote/shared/i18n';
import { CodingUploads } from '../CodingUploads';
import { Archive } from '../Archive';
import type { PageEntry, PageProps } from './types';
export const pages: PageEntry[] = [
    { id: 'coding', route: 'library/coding', get label() { return moteText("Coding 会话同步状态"); }, featureId: 'mote.coding', requires: ['http:GET:/api/coding/uploads'], render: ({ api, onOpen }: PageProps) => <CodingUploads api={api} onOpen={onOpen}/> },
    { id: 'archive', route: 'library', label: moteText('资料库'), section: 'library', order: 0, featureId: 'mote.materials', render: ({ api, devices, activity, onOpen: setEvidenceId, range, rangeSelectionKey, archiveTab, setArchiveTab, timelineRevision, refresh }: PageProps) => <Archive onChanged={refresh} tab={archiveTab} setTab={setArchiveTab} api={api} devices={devices} range={range} rangeSelectionKey={rangeSelectionKey} activity={activity} revision={timelineRevision} onOpen={setEvidenceId}/> },
];
