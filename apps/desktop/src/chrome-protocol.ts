import {z} from 'zod';
export const browserRectSchema=z.object({x:z.number().finite(),y:z.number().finite(),width:z.number().positive().max(32768),height:z.number().positive().max(32768)}).strict();
export const browserNativeContextSchema=z.object({status:z.literal('ok'),appId:z.literal('com.google.Chrome'),pid:z.number().int().positive(),windowId:z.number().int().nonnegative().optional(),visibleBrowserWindows:z.number().int().nonnegative().max(1024),url:z.string().max(2000),window:browserRectSchema,viewport:browserRectSchema,screen:browserRectSchema}).strict();
export type BrowserNativeContext=z.infer<typeof browserNativeContextSchema>;
export const browserBindingSchema=z.object({url:z.string().max(2000),windowId:z.number().int().nonnegative(),tabId:z.number().int().nonnegative(),documentId:z.string().min(1).max(128),window:browserRectSchema,viewport:browserRectSchema,scroll:z.object({x:z.number().finite(),y:z.number().finite()}).strict()}).strict();
export function canonicalBrowserUrl(value:string):string|undefined {try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.href:undefined;}catch{return undefined;}}
export function browserContextMatches(a:BrowserNativeContext,b:BrowserNativeContext):boolean{return JSON.stringify(a)===JSON.stringify(b);}
/** Settings normalize origins before storing them. The bridge accepts only those exact authorities. */
export const chromePermissionOriginsSchema=z.array(z.string().max(2048).refine(value=>{
 try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&!value.includes('*')&&url.origin===value;}catch{return false;}
})).max(100).refine(values=>new Set(values).size===values.length);
export const chromePermissionReplySchema=z.object({type:z.literal('permission-status'),id:z.string().uuid(),status:z.enum(['ok','failed']),origins:z.array(z.object({origin:z.string().max(2048),allowed:z.boolean()}).strict()).max(100)}).strict();
