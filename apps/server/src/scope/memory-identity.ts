import {createHash} from 'node:crypto';
export const memoryHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const memoryUUID=(value:unknown)=>{const hash=memoryHash(value);return hash.slice(0,8)+'-'+hash.slice(8,12)+'-5'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);};
