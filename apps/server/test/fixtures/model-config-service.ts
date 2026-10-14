import {join} from 'node:path';
import type {ModelSettings} from '@mote/shared/models';
import {ConfigService} from '../../src/config-service.js';
import {modelDomainSchema,defaultModelDomain} from '../../src/model-settings.js';
/** Generated, watch-free model-only documents for domain and storage fixtures. */
export function modelConfigService(directory:string,deployment:ModelSettings){
 const service=new ConfigService({path:join(directory,'mote.yaml'),initialDocument:{version:1,revision:0,models:{...defaultModelDomain(),deployment}},watch:false});
 service.register({id:'models',schema:modelDomainSchema,defaultValue:defaultModelDomain()});return service;
}
