import {UserContextAuthority,type IdentityVerifier,type VerifiedIdentity} from '../../src/scope/context.js';
/** Synthetic identities only. No fixture verifier is exported by production. */
export function twoUsers(deploymentId='generated-deployment'){
  const identities=new Map<string,VerifiedIdentity>([
    ['generated-a',{deploymentId,userId:'generated-user-a',credentialId:'credential-a',authorizationEpoch:1,administrator:true}],
    ['generated-b',{deploymentId,userId:'generated-user-b',credentialId:'credential-b',authorizationEpoch:1,administrator:false}],
  ]);
  const disabled=new Set<string>();
  const verifier:IdentityVerifier={verify:async token=>identities.get(token),isCurrent:identity=>!disabled.has(identity.userId)&&[...identities.values()].some(current=>current.userId===identity.userId&&current.credentialId===identity.credentialId&&current.authorizationEpoch===identity.authorizationEpoch)};
  return {authority:new UserContextAuthority(deploymentId,verifier),verifier,disabled,identities};
}
