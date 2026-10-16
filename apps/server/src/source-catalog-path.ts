/** Literal URI structure only. Never opens a remote URI or interprets its contents. */
export function catalogParent(json:unknown){const record=JSON.parse(String(json)),uri=record.provenance?.uri;if(!uri)return '';try{const url=new URL(uri);url.search='';url.hash='';url.pathname=url.pathname.slice(0,url.pathname.lastIndexOf('/')+1);return url.href;}catch{return '';}}
