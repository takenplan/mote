import {z} from 'zod';
import {sourceItemSchema,type SourceItem} from '@mote/shared';
import {createImportSchemas} from './import-disposition-validation.mjs';
const schemas=createImportSchemas(z,sourceItemSchema);
export const importRecordSchema=schemas.recordSchema;
export const importDispositionsSchema=schemas.dispositionsSchema;
export type PreparedRecord={item:SourceItem;evidencePaths:string[];attachments:string[]};
