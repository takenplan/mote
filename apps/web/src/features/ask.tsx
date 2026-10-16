import React from 'react';
import { moteText } from '@mote/shared/i18n';
import { modelSetupHref } from '../ModelStartGuide';

import { Ask } from '../Ask';
import {useResource} from '../useResource';
import {errorMessage} from '../api';
import {askModelSelectionPath} from '../ask-model-selection';
import type { PageEntry,PageProps } from './types';
function ScopedAsk({api,onPage,onOpen}:PageProps){
  const models=useResource<{selections:{chat?:unknown}}>(api,'/api/models'),selection=useResource<{model:string}>(api,askModelSelectionPath(models.data)),devices=useResource<{items:{id:string;name:string}[]}>(api,'/api/ingress/devices');
  return <>{models.error!==undefined&&<p role="alert">{errorMessage(models.error)}</p>}{selection.error!==undefined&&<p role="alert">{errorMessage(selection.error)}</p>}{devices.error!==undefined&&<p role="alert">{errorMessage(devices.error)}</p>}<Ask api={api} configured={Boolean(selection.data?.model)} devices={(devices.data?.items??[]).map(device=>({deviceId:device.id,deviceName:device.name}))} onOpen={onOpen} onInsights={()=>onPage('insights')} onSettings={()=>{window.location.hash=modelSetupHref('providers',window.location.hash);}}/></>;
}

export const pages:PageEntry[]=[
{id:'ask',route:'ask',label:moteText('问一问'),featureId:'mote.ask',render:(props:PageProps)=>props.api.connection?.mode==='web'?<ScopedAsk {...props}/>:props.status?(
                        <Ask
                          api={props.api}
                          devices={props.devices}
                          status={props.status}
                          onOpen={props.onOpen}
                          onInsights={()=>props.onPage("insights")}
                          onSettings={()=>{window.location.hash=modelSetupHref('providers',window.location.hash);}}
                        />
                      ):null},
];
