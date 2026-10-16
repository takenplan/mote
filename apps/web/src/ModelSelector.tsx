import { moteText } from '@mote/shared/i18n';
import { useId, useEffect } from 'react';
import { useResource } from './useResource';
import { DEPLOYMENT_MODEL_PROFILE_ID, type ModelFeature, type ModelSettingsView } from '@mote/shared/models';
import { type Api, errorMessage } from './api';
type ModelSelectorProps={
    api: Api;
    feature: ModelFeature;
    value: string;
    onChange: (id: string) => void;
    disabled?: boolean;
    model?: string;
    onModelChange?: (value: string) => void;
};
export function ModelSelector(props:ModelSelectorProps){return props.api.connection?.mode==='web'?<WebModelSelector {...props}/>:<LegacyModelSelector {...props}/>;}
function WebModelSelector({api,feature,value,onChange,disabled,model,onModelChange}:ModelSelectorProps){
 const settings=useResource<{personal:{id:string;name:string;settings:{model:string}}[];shared:{id:string;name:string;model:string}[];selections:Partial<Record<ModelFeature,{kind:'personal'|'shared';id:string}>>}>(api,'/api/models');
 const choices=[...(settings.data?.personal??[]).map(profile=>({id:'personal:'+profile.id,name:profile.name,model:profile.settings.model})),...(settings.data?.shared??[]).map(profile=>({id:'shared:'+profile.id,name:profile.name,model:profile.model}))];
 const selected=settings.data?.selections[feature],defaultId=selected?selected.kind+':'+selected.id:'',profile=choices.find(choice=>choice.id===(value||defaultId)),defaultProfile=choices.find(choice=>choice.id===defaultId),personal=(value||defaultId).startsWith('personal:');
 useEffect(()=>{onModelChange?.('');},[api,value,defaultId,onModelChange]);
 const caption=moteText('功能默认')+(defaultProfile?' · '+defaultProfile.name+' / '+defaultProfile.model:'');
 return <label className="model-selector"><span>{moteText('本次模型')}</span><select aria-label={moteText('本次模型')} value={value} disabled={disabled||settings.loading&&!settings.data} onChange={event=>{onChange(event.target.value);onModelChange?.('');}}><option value="">{caption}</option>{value&&!choices.some(choice=>choice.id===value)&&<option value={value}>{moteText('配置已不可用，请重新选择')}</option>}{choices.map(choice=><option key={choice.id} value={choice.id}>{choice.name} · {choice.model||moteText('未配置')}{choice.id.startsWith('shared:')?moteText(' · 只读'):''}</option>)}</select><span className="model-selector-selection" aria-hidden="true">{value?(profile?profile.name+' · '+profile.model:moteText('配置已不可用，请重新选择')):caption}</span>{onModelChange&&<><span>Provider → {moteText('模型')}</span><input aria-label={moteText('临时模型 ID')} placeholder={profile?.model||moteText('模型 ID')} value={model??''} disabled={disabled||!personal} maxLength={512} onChange={event=>onModelChange(event.target.value)}/></>}{settings.error!==undefined&&<small role="alert">{moteText('无法读取模型列表：')}{errorMessage(settings.error)}</small>}</label>;
}
function LegacyModelSelector({ api, feature, value, onChange, disabled, model, onModelChange }:ModelSelectorProps) {
    const settings = useResource<ModelSettingsView>(api, '/api/model-settings'), view = settings.data;
    const profiles = view?.profiles ?? [], defaultId = view?.defaults[feature] ?? DEPLOYMENT_MODEL_PROFILE_ID, selected = profiles.find(p => p.id === defaultId), providerId = value || defaultId;
    const catalog = useResource<{
        items: {
            id: string;
            name: string;
        }[];
    }>(api, onModelChange && view ? `/api/model-settings/profiles/${encodeURIComponent(providerId)}/models` : null), models = catalog.data?.items ?? [];
    const error = settings.error || catalog.error, modelListId = useId();
    const profile = profiles.find(item => item.id === providerId);
    const defaultCaption = moteText("功能默认") + (selected ? ' · ' + selected.name + ((view?.defaultModels[feature] || selected.settings.model) ? ' / ' + (view?.defaultModels[feature] || selected.settings.model) : '') : '');
    const selectionCaption = !value ? defaultCaption : profile ? profile.name + ' · ' + (profile.settings.model || moteText("未配置")) : moteText("配置已不可用，请重新选择");
    const catalogMessage = catalog.error && profile && (!profile.settings.baseUrl || !profile.settings.model) ? moteText("请先在「设置 → 模型与服务 → 模型 Provider」配置服务地址和模型。尚未配置时，模型目录不可读取。") : catalog.error instanceof Error && catalog.error.message === 'model_catalog_unavailable' ? moteText("暂时无法读取服务商模型目录。请检查已配置的地址、凭据和服务商支持情况；也可填写模型 ID。") : errorMessage(error);
    return <label className="model-selector"><span>{moteText("本次模型")}</span><select aria-label={moteText("本次模型")} value={value} disabled={disabled || settings.loading && !view} onChange={e => { onChange(e.target.value); onModelChange?.(''); }}><option value="">{defaultCaption}</option>{value && !profiles.some(p => p.id === value) && <option value={value}>{moteText("配置已不可用，请重新选择")}</option>}{profiles.map(p => <option key={p.id} value={p.id}>{p.name} · {p.settings.model || moteText("未配置")}</option>)}</select><span className="model-selector-selection" aria-hidden="true">{selectionCaption}</span>{onModelChange && <><span>Provider → {moteText("模型")}</span><input aria-label={moteText("临时模型 ID")} placeholder={(!value ? view?.defaultModels[feature] : undefined) || profiles.find(p => p.id === providerId)?.settings.model || moteText("模型 ID")} list={modelListId} disabled={disabled} value={model ?? ''} maxLength={512} onChange={e => onModelChange(e.target.value)}/><datalist id={modelListId}>{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</datalist></>}{!!error && <small role="alert">{moteText("无法读取模型列表：")}{catalogMessage}</small>}</label>;
}
