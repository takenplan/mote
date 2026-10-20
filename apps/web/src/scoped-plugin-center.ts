import type {PluginCenterView,ScopedPluginCenterView,ScopedPluginInstance} from '@mote/shared';

/** Presentation only. Authority and package/instance revisions remain distinct. */
export function scopedPluginCenter(value:ScopedPluginCenterView,administrator?:PluginCenterView):PluginCenterView{
 return {revision:value.revision,installation:administrator?.installation??{supported:false,runtime:'worker',restartRequired:false},catalog:administrator?.catalog??[],packages:value.packages.map(pkg=>({...pkg,allowedActions:[...pkg.allowedActions,...(administrator?.packages.find(item=>item.id===pkg.id)?.allowedActions.includes('uninstall')?['uninstall' as const]:[])]})),instances:value.instances.map(instance=>({id:instance.id,packageId:instance.packageId,name:instance.name,revision:value.revision,scope:instance.grants.sourceIds.join(', '),configurationSchema:value.packages.find(pkg=>pkg.id===instance.packageId)?.configurationSchema??[],configuration:instance.configuration,secretStatus:instance.secretStatus,capabilities:instance.capabilities,desired:instance.desired,observed:instance.observed??'unknown',issues:instance.issues??[],allowedActions:instance.observed==='checking'?[]:instance.desired?['disable']:['configure','check',...(instance.checked&&!instance.issues?.length?['enable' as const]:[])]}))};
}

export function scopedPluginConfiguration(previous:ScopedPluginInstance|undefined,packageId:string,body:{name:string;configuration:Record<string,string|number|boolean>;grants:ScopedPluginInstance['grants']}){
 return {id:previous?.id??crypto.randomUUID(),packageId,name:body.name,configuration:body.configuration,desired:false,revocation:previous?.revocation??'initial',grants:body.grants};
}
