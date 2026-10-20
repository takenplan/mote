import type { FastifyInstance } from 'fastify';
import type { FeatureServices } from '../feature-services.js';
import { usageQuerySchema } from '../usage-query.js';

/** usage: owns its transport, data and command contributions. */
export function register(app:FastifyInstance,{usageLedger}:Pick<FeatureServices,"usageLedger">){
app.get('/api/usage',async req=>{
    const {from,to,timeZone,groupBy,page,pageSize,...filters}=usageQuerySchema.parse(req.query);
    return usageLedger.summary(from,to,timeZone,filters,groupBy,page,pageSize);
  });
app.put('/api/usage/prices',async req=>usageLedger.setPrice(req.body));
}
