import { moteText } from '@mote/shared/i18n';
import React from "react";
import { AdvancedConfiguration } from "../ServerSettings";

const Diagnostics = React.lazy(()=>import('../Diagnostics').then(module=>({default:module.Diagnostics})));
const SoftwareUpdate = React.lazy(()=>import('../SoftwareUpdate').then(module=>({default:module.SoftwareUpdate})));

import type { PageEntry,PageProps } from './types';
function renderDiagnostics({api,status}:PageProps){
 const web=api.connection?.mode==='web';
 if(api.connection?.mode==='web'&&!api.connection.administrator)return <p role="status">{moteText('实例诊断与更新检查仅向当前管理员开放。')}</p>;
 if(!web&&!status)return null;
 return <><div className="page-heading"><div className="eyebrow">{moteText('开发与维护')}</div><h1>{moteText('诊断与更新')}</h1><p>{moteText('查看运行诊断，按需调整日志与高级部署配置。')}</p></div><SoftwareUpdate api={api}/><Diagnostics api={api} profile={status?.profile}/>{web?<p role="status">{moteText('实例日志与更新配置由启动 YAML 管理，网页编辑协议尚待接入。')}</p>:<AdvancedConfiguration api={api}/>}</>;
}

export const pages:PageEntry[]=[
{id:'developer',route:'system/diagnostics',label:moteText('诊断与更新'),section:'system',order:7,featureId:'mote.diagnostics',render:renderDiagnostics},
];
