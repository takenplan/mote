import {z} from 'zod';

// Portable validation must not initialize the Store or its archive runtime.
const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const recordContextDeclarationSchema=z.object({captureId:z.string().uuid(),version:z.literal(1),captureFingerprint:hash,description:z.string().min(1).max(12000)}).strict();
export const portableRecordContextSchema=z.object({declarations:z.array(recordContextDeclarationSchema.extend({fingerprint:hash}).strict())}).strict();
export type PortableRecordContext=z.infer<typeof portableRecordContextSchema>;
