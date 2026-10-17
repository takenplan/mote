import type {FastifyRequest} from 'fastify';
import {requestContext,type ScopedRuntime} from '../../server/src/scope/http.js';

export type FixtureActor = 'a' | 'b' | 'other';

/** Resolve fixture faults through the same current Cookie/Bearer binding as the
 * real route. A session header or a familiar token alone never selects A/B. */
export async function requestActor(
  request:FastifyRequest,
  runtime:Pick<ScopedRuntime,'authority'|'accounts'>,
  actors:{a:{userId:string};b:{userId:string}},
):Promise<FixtureActor>{
  const context=await requestContext(request,runtime.authority,runtime.accounts);
  return context.userId===actors.a.userId?'a':context.userId===actors.b.userId?'b':'other';
}
