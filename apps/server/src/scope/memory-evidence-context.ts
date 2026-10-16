import {unknownAttributionContext,type AttributionContext} from '@mote/shared';
import type {PrivateData} from './private-data.js';
import {PrivateDataError} from './private-data-sql.js';
/** Block context can refine a declaration, but cannot drop pinned source prose. */
export function memoryAttribution(data:PrivateData,base?:AttributionContext,block?:AttributionContext):AttributionContext{
 const value=structuredClone({...base??unknownAttributionContext(),...block}),pins=new Map<string,NonNullable<AttributionContext['sourceContextDeclarations']>[number]>();
 for(const pin of [...base?.sourceContextDeclarations??[],...block?.sourceContextDeclarations??[]]){const prior=pins.get(pin.sourceId);if(prior&&(prior.version!==pin.version||prior.fingerprint!==pin.fingerprint))throw new PrivateDataError('conflict',409);pins.set(pin.sourceId,pin);}
 if(pins.size)value.sourceContextDeclarations=[...pins.values()];
 value.sourceContextStatements=[...pins.values()].map(pin=>{const context=data.sourceContext(pin.sourceId,pin.version);if(context.fingerprint!==pin.fingerprint)throw new PrivateDataError('conflict',409);return {sourceId:pin.sourceId,version:pin.version,description:context.description};});return value;
}
