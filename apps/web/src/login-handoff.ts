import {clearSession} from './session';
import {changeWebAuthentication,discoverWebSession,publicAuth} from './web-auth';
import type { Connection } from './api';
const valid = (value:string|null):value is string => !!value&&/^[A-Za-z0-9_-]{43}$/.test(value);
export function loginRequestId():string|undefined{const value=new URLSearchParams(location.hash.split('?')[1]??'').get('loginRequest');return valid(value)?value:undefined;}
export function removeLoginParameter(key:string){const [route,query='']=location.hash.split('?'),params=new URLSearchParams(query);params.delete(key);history.replaceState(null,'',location.pathname+location.search+route+(params.size?'?'+params:''));}
/** Exchange before rendering private UI; failure never restores an unrelated old login. */
export async function consumeLoginTicket(active:()=>boolean=()=>true):Promise<Connection|undefined>{
  const value=new URLSearchParams(location.hash.split('?')[1]??'').get('loginTicket');if(value===null)return;
  removeLoginParameter('loginTicket');clearSession();if(!valid(value))throw Error('Invalid login link');
  return changeWebAuthentication(async()=>{
    const grant=await publicAuth<{credentialId:string}>('/api/login/exchange',{code:value});
    if(!active())throw Error('Login changed');
    const session=await discoverWebSession();
    if(!active()||!session||session.credentialId!==grant.credentialId)throw Error('Login changed');
    return session;
  });
}
