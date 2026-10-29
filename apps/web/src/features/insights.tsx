import { moteText } from '@mote/shared/i18n';
import { modelSetupHref } from '../ModelStartGuide';
import React from "react";

const Insights = React.lazy(()=>import('../Insights').then(module=>({default:module.Insights})));

import type { PageEntry,PageProps } from './types';

export const pages:PageEntry[]=[
{id:'insights',route:'library/insights',label:moteText('发现'),section:'library',order:7,featureId:'mote.insights',render:({api,status,onPage,onOpen:setEvidenceId,range,timelineRevision,refresh}:PageProps)=><Insights api={api} refreshVersion={timelineRevision} range={range} configured={status?.agent.configured??false} onOpen={setEvidenceId} onSettings={()=>{window.location.hash=modelSetupHref('providers',window.location.hash);}} onChanged={refresh}/>},
];
