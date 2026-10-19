// Remote release transport fixture only. Does not import or patch any Mote code.
import {readFileSync, appendFileSync} from 'node:fs';
const tablePath = process.env.R5_RELEASE_TABLE;
const ledgerPath = process.env.R5_OUTBOUND_LEDGER;
const realFetch = globalThis.fetch;
globalThis.fetch = async function(input, init) {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const table = tablePath ? JSON.parse(readFileSync(tablePath, 'utf8')) : {};
  const match = table[url];
  if (match) {
    if (ledgerPath) appendFileSync(ledgerPath, JSON.stringify({at:new Date().toISOString(),url,kind:'generated-release-transport'})+'\n');
    return new Response(readFileSync(match.path), {status:200,headers:{'content-type':match.type??'application/octet-stream'}});
  }
  const parsed = new URL(url);
  if (['127.0.0.1','localhost','[::1]'].includes(parsed.hostname)) return realFetch(input,init);
  if (ledgerPath) appendFileSync(ledgerPath, JSON.stringify({at:new Date().toISOString(),url:parsed.origin+parsed.pathname,kind:'FORBIDDEN_OUTBOUND_REJECTED'})+'\n');
  throw new Error('R05 evaluator prohibits live/outbound service calls');
};
