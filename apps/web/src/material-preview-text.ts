export type MaterialExcerpt={text:string;spans?:{kind:string;format?:string;pageRange:{start:number;end:number}}[]};
/** Render declared text spans only. A plain body that looks like JSON stays literal body text. */
export function materialTextExcerpt(value:MaterialExcerpt):string{
 return (value.spans??[]).filter(span=>span.kind==='text'&&span.format!=='json'&&Number.isSafeInteger(span.pageRange.start)&&Number.isSafeInteger(span.pageRange.end)&&span.pageRange.start>=0&&span.pageRange.end>=span.pageRange.start&&span.pageRange.end<=value.text.length).map(span=>value.text.slice(span.pageRange.start,span.pageRange.end)).join('\n');
}
