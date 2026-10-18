import { moteText } from '@mote/shared/i18n';
import { Usage } from '../Usage';
import { apiOwnerKey } from '../api';

import type { PageEntry,PageProps } from './types';

export const pages:PageEntry[]=[
{id:'usage',route:'system/usage',label:moteText('用量与费用'),section:'system',order:5,featureId:'mote.usage',render:({api}:PageProps)=><Usage key={apiOwnerKey(api)} api={api}/>},
];
