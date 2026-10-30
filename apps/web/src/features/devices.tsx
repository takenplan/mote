import { moteText } from '@mote/shared/i18n';
import { DeviceOverview } from "../DeviceOverview";
import type { PageEntry, PageProps } from './types';
export const pages: PageEntry[] = [
    { id: 'devices', route: 'connections/devices', label: moteText('采集与设备'), section: 'connections', order: 1, featureId: 'mote.devices', render: ({ api,devices,onOpen,refresh,onPage }: PageProps) => (<DeviceOverview api={api} onOpen={onOpen} onRefresh={refresh} devices={devices} onConnect={() => onPage("deviceConnections")} onAdd={() => onPage("sourceCatalog")} onSources={() => onPage("sources")}/>) },
];
