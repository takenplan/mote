/** Shared transport failure used by credential adapters and login handoffs. */
export class ConnectionError extends Error {
  constructor(readonly code:string,readonly statusCode:number,readonly publicMessage:string){super(code);this.name='ConnectionError';}
}
