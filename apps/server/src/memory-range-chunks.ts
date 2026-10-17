/** Shared original-range partition used by both legacy fixtures and the scoped
 * M05 adapter. Every UTF-16 code unit belongs to one complete range. */
export function memoryRangeChunks(text:string,range:{offset:number;length:number},budget:number,preferLines:boolean){
 if(!Number.isSafeInteger(budget)||budget<1||range.offset<0||range.length<1||range.offset+range.length>text.length)throw new Error('Invalid Memory original range');
 const pair=(at:number)=>at>0&&at<text.length&&/[\uD800-\uDBFF]/.test(text[at-1])&&/[\uDC00-\uDFFF]/.test(text[at]);
 if(pair(range.offset)||pair(range.offset+range.length))throw new Error('Memory evidence range splits a UTF-16 pair');
 const chunks:{offset:number;length:number}[]=[];
 for(let offset=range.offset;offset<range.offset+range.length;){let end=Math.min(offset+budget,range.offset+range.length);if(preferLines&&end<range.offset+range.length){const boundary=text.lastIndexOf('\n',end-1);if(boundary>=offset)end=boundary+1;}if(pair(end))end--;if(end<=offset)throw new Error('Memory range budget cannot contain a character');chunks.push({offset,length:end-offset});offset=end;}
 return chunks;
}
