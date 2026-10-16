/** UTF-16 coordinates remain stable while no returned window splits a scalar.
 * Shared by protocol projections and the actual scoped original reader. */
export function safeTextWindow(text:string,offset=0,length=4000){
 let start=Math.min(offset,text.length),end=Math.min(start+length,text.length);
 const split=(at:number)=>at>0&&at<text.length&&/[\uD800-\uDBFF]/.test(text[at-1])&&/[\uDC00-\uDFFF]/.test(text[at]);
 if(split(start))start--;if(split(end))end--;if(end<=start&&start<text.length)end=Math.min(start+2,text.length);
 return {text:text.slice(start,end),textRange:{offset:start,total:text.length,nextOffset:end<text.length?end:null}};
}
