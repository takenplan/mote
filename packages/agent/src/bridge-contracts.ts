/** Private adapter framing only. Tool grants and disclosure live in the session. */
export interface BridgeToolRequest {
  tool:string;
  readArguments():Promise<Record<string,unknown>>;
}

/** Delivery completion and disconnection remain visible to the disclosure owner. */
export interface BridgeToolReply {
  readonly destroyed:boolean;
  writeHead(status:number):BridgeToolReply;
  end(body:string,delivered?:()=>void):void;
  once(event:'close',listener:()=>void):unknown;
  off(event:'close',listener:()=>void):unknown;
}

export type BridgeToolHandler=(request:BridgeToolRequest,reply:BridgeToolReply)=>Promise<void>;
