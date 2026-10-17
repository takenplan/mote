/** Independent persisted/wire contracts, not product release numbers. */
export const SCOPE_BASELINE = Object.freeze({storageEpoch:5, wireProtocol:2, ingressProtocol:3, portableArchive:3});
export const SCOPE_FORMAT = 'mote-private-users-v1';
export const validScopeId=(id:unknown):id is string=>typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(id);

export class ScopeError extends Error {
  constructor(readonly code:'identity_required'|'invalid_identity'|'incompatible_protocol'|'scope_unavailable'|'undeclared_scope'|'unsupported_vault', readonly statusCode:number){super(code);}
}
