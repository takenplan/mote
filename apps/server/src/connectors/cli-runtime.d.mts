export const cliReleases:Record<'lark'|'dingtalk',{version:string;binary:string;repository:string;archives:Record<string,[string,string]>}>;
export const cliRuntimeDirectory:string;
export function managedCliBinary(provider:'lark'|'dingtalk',directory?:string,platform?:string,arch?:string):string;
