import { moteText } from '@mote/shared/i18n';
import React from "react";

const Connections = React.lazy(()=>import('../Connections').then(module=>({default:module.Connections})));

import type { PageEntry,PageProps } from './types';

export const pages:PageEntry[]=[
{id:'connections',route:'connections/access',label:moteText('AI 接入'),section:'connections',order:2,featureId:'mote.connections',render:({api,devices}:PageProps)=><Connections key="chatbot" mode="chatbot" api={api} serverUrl={window.location.origin} devices={devices}/>},
{id:'deviceConnections',route:'connections/pair',label:moteText('连接设备'),section:'connections',order:1,featureId:'mote.connections',render:({api,devices}:PageProps)=><Connections key="device" mode="device" api={api} serverUrl={window.location.origin} devices={devices}/>},
];
