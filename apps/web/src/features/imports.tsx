import { moteText } from '@mote/shared/i18n';
import { modelSetupHref } from '../ModelStartGuide';
import React from "react";

const Imports = React.lazy(()=>import('../Imports').then(module=>({default:module.Imports})));

import type { PageEntry,PageProps } from './types';
import type {Api} from '../api';
const importOwners=new WeakMap<Api,number>();let nextImportOwner=0;
function importOwner(api:Api){let id=importOwners.get(api);if(id===undefined){id=++nextImportOwner;importOwners.set(api,id);}return id;}

export const pages:PageEntry[]=[
{id:'imports',route:'library/import',label:moteText('导入'),section:'library',order:8,featureId:'mote.imports',render:({api,onPage,onOpen:setEvidenceId,setArchiveTab,timelineRevision,refresh}:PageProps)=><Imports key={importOwner(api)} api={api} refreshVersion={timelineRevision} onOpen={setEvidenceId} onMemories={()=>{setArchiveTab("memories");onPage("archive");}} onSettings={()=>{window.location.hash=modelSetupHref('providers',window.location.hash);}} onChanged={refresh}/>},
];
