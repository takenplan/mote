/** Only vendor authorization URLs are projected into private task progress.
 * The first complete URL line is authoritative: DWS prints its full link before
 * the separate manual-code URL, which must never replace it. */
export function authorizationOutput(provider:'lark'|'dingtalk',publish:(url:string)=>void){
 let pending='',published=false;
 const consume=(line:string)=>{
  if(published)return;
  try{const raw=line.trim(),url=new URL(raw),domains=provider==='lark'?['feishu.cn','larksuite.com','larkoffice.com']:['dingtalk.com','dingtalk.cn','dingtalk.io'];
   if(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&domains.some(domain=>url.hostname===domain||url.hostname.endsWith('.'+domain))){published=true;publish(raw);}
  }catch{}
 };
 return (chunk:string)=>{pending+=chunk;const lines=pending.split(/\r?\n/);pending=lines.pop()!;for(const line of lines)consume(line);};
}
