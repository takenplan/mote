import { moteText } from '@mote/shared/i18n';
import { modelSetupHref } from '../ModelStartGuide';
import React from "react";

const Insights = React.lazy(()=>import('../Insights').then(module=>({default:module.Insights})));

import type { PageEntry,PageProps } from './types';
import {useResource} from '../useResource';
import {errorMessage} from '../api';
import {askModelSelectionPath} from '../ask-model-selection';

function InsightPage({api,status,onOpen,onSettings,onChanged,range,refreshVersion}:{api:PageProps['api'];status:PageProps['status'];range:PageProps['range'];refreshVersion:number;onOpen:(id:string)=>void;onSettings:()=>void;onChanged:()=>void}){
 const web=api.connection?.mode==='web',models=useResource<{selections:{insight?:unknown}}>(api,web?'/api/models':null),selection=useResource<{model:string}>(api,web?askModelSelectionPath(models.data,'insight'):null);
 return <>{models.error!==undefined&&<p role="alert">{errorMessage(models.error)}</p>}{selection.error!==undefined&&<p role="alert">{errorMessage(selection.error)}</p>}<Insights api={api} refreshVersion={refreshVersion} range={range} configured={web?Boolean(selection.data?.model):status?.agent.configured??false} onOpen={onOpen} onSettings={onSettings} onChanged={onChanged}/></>;
}

export const pages:PageEntry[]=[
{id:'insights',route:'library/insights',label:moteText('洞察'),section:'library',order:7,featureId:'mote.insights',render:({api,status,onPage,onOpen:setEvidenceId,range,timelineRevision,refresh}:PageProps)=><InsightPage api={api} status={status} refreshVersion={timelineRevision} range={range} onOpen={setEvidenceId} onSettings={()=>{window.location.hash=modelSetupHref('providers',window.location.hash);}} onChanged={refresh}/>},
];
