import {z} from 'zod';
import {MODEL_FEATURES} from '@mote/shared/models';
import {registerAuthenticatedRoute,registerUserRoute,type ScopedRuntime} from './http.js';
import type {Configurations,UserConfigurationService} from './configuration.js';

const revision=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
/** Page editors and operator file edits use exactly the same domain registry,
 * queue and CAS. These endpoints cannot select a target account or file path. */
export function registerConfigurationRoutes(runtime:ScopedRuntime,configuration:Configurations){
  runtime.services.registerUser('configuration',{scope:'user',create:context=>configuration.forUser(context),lifecycle:configuration.lifecycle});
  runtime.services.registerInstance('model-resources',{scope:'instance',service:configuration.instance});
  const log=(event:string,fields:Parameters<NonNullable<typeof runtime.diagnostics>['record']>[1]={},level:'debug'|'info'|'warn'|'error'='info')=>runtime.diagnostics?.record(event,fields,level);
  registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/configuration',service:'configuration',handle:({services})=>services.get<UserConfigurationService>('configuration').view()});
  registerUserRoute(runtime,{scope:'user',method:'PATCH',url:'/api/configuration',service:'configuration',handle:async({services,request,context})=>{
    const input=z.object({revision,patches:z.record(z.unknown()),allowCredentialReuse:z.boolean().optional(),preserveRedactedSecrets:z.boolean().default(false)}).strict().parse(request.body);
    const result=await services.get<UserConfigurationService>('configuration').update(input.patches,input.revision,input.allowCredentialReuse,input.preserveRedactedSecrets);
    log('config.updated',{userId:context.userId,name:Object.keys(input.patches).join(','),revision:result.revision});
    return result;
  }});
  registerUserRoute(runtime,{scope:'user',method:'PUT',url:'/api/configuration/:domain',service:'configuration',handle:async({services,request,context})=>{
    const input=z.object({revision,value:z.unknown(),preserveRedactedSecrets:z.boolean().default(false),allowCredentialReuse:z.boolean().optional()}).strict().parse(request.body),domain=z.object({domain:z.string().regex(/^[a-z][a-zA-Z0-9_-]*$/)}).strict().parse(request.params).domain;
    const result=await services.get<UserConfigurationService>('configuration').replace(domain,input.value,input.revision,input.preserveRedactedSecrets,input.allowCredentialReuse);
    log('config.domain_replaced',{userId:context.userId,name:domain,revision:result.revision});
    return result;
  }});
  registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/configuration/reload',service:'configuration',handle:async({services,request,context})=>{z.object({}).strict().parse(request.body??{});const result=await services.get<UserConfigurationService>('configuration').reload();log('config.reloaded',{userId:context.userId});return result;}});
  registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/models',service:'configuration',handle:({services})=>services.get<UserConfigurationService>('configuration').models()});
  registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/models/profiles/:id/copy',service:'configuration',handle:async({services,request,context})=>{const result=await services.get<UserConfigurationService>('configuration').copyModel(z.object({id:z.string()}).strict().parse(request.params).id,request.body);log('config.model_copied',{userId:context.userId});return result;}});
  registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/models/catalog',service:'configuration',handle:({services,request})=>services.get<UserConfigurationService>('configuration').modelCatalog(request.body)});
  registerUserRoute(runtime,{scope:'user',method:'POST',url:'/api/models/probe',service:'configuration',handle:({services,request,context})=>{const probe=services.get<UserConfigurationService>('configuration').probeModel(request.body);return Promise.resolve(probe).then(result=>{log('config.model_probed',{userId:context.userId,state:(result as {code?:string})?.code??'ok'});return result;});}});
  registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/models/selection/:feature',service:'configuration',handle:({services,request})=>{
    const feature=z.object({feature:z.enum(MODEL_FEATURES)}).strict().parse(request.params).feature;
    return services.get<UserConfigurationService>('configuration').selection(feature);
  }});
  registerUserRoute(runtime,{scope:'user',method:'GET',url:'/api/usage',service:'configuration',handle:({services,request})=>{const service=services.get<UserConfigurationService>('configuration');return Object.keys(request.query as object).length?service.usageSummary(request.query):service.usage();}});
  registerUserRoute(runtime,{scope:'user',method:'PUT',url:'/api/usage/prices',service:'configuration',handle:({services,request})=>services.get<UserConfigurationService>('configuration').setUsagePrice(request.body)});
  // Instance administration only exposes the deployment resource domain. The
  // general private endpoint above always stays bound to the admin's own user.
  registerAuthenticatedRoute(runtime,{method:'GET',url:'/api/admin/configuration/models',administrator:true,handle:()=>{
    const view=configuration.instance.view();return {version:view.version,revision:view.revision,domains:view.domains.filter(d=>d.id==='models'),lastError:view.lastError};
  }});
  registerAuthenticatedRoute(runtime,{method:'PUT',url:'/api/admin/configuration/models',administrator:true,handle:(context,request)=>{
    const input=z.object({revision,value:z.unknown(),preserveRedactedSecrets:z.boolean().default(false),allowCredentialReuse:z.boolean().optional()}).strict().parse(request.body);
    return configuration.replaceSharedModels(context,input.value,input.revision,input.preserveRedactedSecrets,input.allowCredentialReuse).then(view=>({version:view.version,revision:view.revision,domains:view.domains.filter(d=>d.id==='models'),lastError:view.lastError}));
  }});
}
