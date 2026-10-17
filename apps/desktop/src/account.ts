import {createHash} from 'node:crypto';
import type {Config} from './contracts';

/** Confirmed by M01 connections/self; credentials and account ownership are distinct. */
export interface DesktopAccount {origin:string;deploymentId:string;userId:string;username:string}
export const DESKTOP_PROTOCOL_HEADERS={'X-Mote-Protocol-Version':'2'} as const;
export function validateAccount(value:unknown,origin:string):DesktopAccount {
 const account=value as DesktopAccount;
 if(!account||account.origin!==origin||!/^https?:\/\//.test(origin)||['deploymentId','userId','username'].some(key=>typeof account[key as keyof DesktopAccount]!=='string'||!account[key as keyof DesktopAccount]||account[key as keyof DesktopAccount].length>200||/[\x00-\x1f\x7f]/.test(account[key as keyof DesktopAccount])))throw Error('Invalid desktop account binding');
 return {origin:account.origin,deploymentId:account.deploymentId,userId:account.userId,username:account.username};
}
export function accountKey(config:Pick<Config,'serverUrl'|'account'>):string|undefined {
 if(!config.account)return;
 const a=validateAccount(config.account,config.serverUrl);
 return createHash('sha256').update(JSON.stringify([a.origin,a.deploymentId,a.userId])).digest('hex');
}
export function sameAccount(a:Pick<Config,'serverUrl'|'account'>,b:Pick<Config,'serverUrl'|'account'>):boolean {const key=accountKey(a);return Boolean(key&&key===accountKey(b));}
