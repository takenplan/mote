/** Date controls express local calendar days, including daylight-saving changes. */
export function perceptionDateBoundary(day:string,exclusiveEnd=false):string{
 const date=new Date(day+'T00:00:00');
 if(exclusiveEnd)date.setDate(date.getDate()+1);
 return date.toISOString();
}
