import {z} from 'zod';
import {sourceContextDeclarationSchema,sourceContextSnapshotSchema} from '@mote/shared';

// Archive validation is independent of the Store-backed declaration runtime.
export const sourceContextArchiveDeclarationSchema=sourceContextSnapshotSchema.extend({version:z.number().int().positive(),fingerprint:sourceContextDeclarationSchema.shape.fingerprint,updatedAt:z.string().datetime({offset:true})}).strict();
export const portableSourceContextSchema=z.object({declarations:z.array(sourceContextArchiveDeclarationSchema)}).strict();
export type PortableSourceContext=z.infer<typeof portableSourceContextSchema>;
