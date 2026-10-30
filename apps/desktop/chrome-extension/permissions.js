/** Reads only the exact configured origins; it never requests access or inspects a page. */
export async function permissionStatus(message,permissions){
 if(!message||message.type!=='permission-status'||typeof message.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(message.id)||!Array.isArray(message.origins)||message.origins.length>100||new Set(message.origins).size!==message.origins.length)return;
 for(const origin of message.origins){try{const url=new URL(origin);if(typeof origin!=='string'||origin.length>2048||!['http:','https:'].includes(url.protocol)||url.username||url.password||origin.includes('*')||url.origin!==origin)return;}catch{return;}}
 try{const origins=[];for(const origin of message.origins)origins.push({origin,allowed:await permissions.contains({origins:[`${origin}/*`]})});return {type:'permission-status',id:message.id,status:'ok',origins};}
 catch{return {type:'permission-status',id:message.id,status:'failed',origins:[]};}
}
