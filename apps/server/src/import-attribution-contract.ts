import {z} from 'zod';

// Archive validation is independent of the Store-backed declaration runtime.
export const importAttributionDeclarationSchema=z.object({id:z.string().uuid(),version:z.number().int().positive(),sourceId:z.string().min(1).max(128),instruction:z.string().max(12000)}).strict();
export const portableImportAttributionSchema=z.object({
  declarations:z.array(importAttributionDeclarationSchema.extend({fingerprint:z.string().regex(/^[a-f0-9]{64}$/)}).strict()),
  captures:z.array(z.object({captureId:z.string().uuid(),id:z.string().uuid(),version:z.number().int().positive()}).strict()),
}).strict();
export type PortableImportAttribution=z.infer<typeof portableImportAttributionSchema>;
