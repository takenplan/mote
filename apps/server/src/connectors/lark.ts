import {LarkAdapter} from './lark-adapter.js';
import {legacyLarkContext} from './lark-legacy.js';
import type {ConnectorContext} from './types.js';
import type {LarkRunner} from './lark-cli.js';
export {LARK_SCOPES,documentReference,larkEvent} from './lark-adapter.js';
export class LarkConnector extends LarkAdapter {constructor(ctx:ConnectorContext,runner?:LarkRunner){super(legacyLarkContext(ctx),runner);}}
