import {z} from 'zod';
import {modelProfileIdSchema} from './model-settings.js';
import {scopeFields,validRange} from './query-scope.js';

const querySchema=z.object({modelProfileId:modelProfileIdSchema.optional(),modelOverride:z.string().trim().min(1).max(512).refine(v=>!/[\u0000-\u001f\u007f]/.test(v)).optional(),question:z.string().trim().min(1).max(8000),conversationId:z.string().uuid().optional(),anchorEvidenceIds:z.array(z.string().uuid()).min(1).max(30).refine(ids=>new Set(ids).size===ids.length).nullable().optional(),evidenceIds:z.array(z.string().uuid()).min(1).max(30).refine(ids=>new Set(ids).size===ids.length).nullable().optional(),after:scopeFields.after.nullable(),before:scopeFields.before.nullable(),deviceId:scopeFields.deviceId.nullable(),timeZone:scopeFields.timeZone.nullable()}).strict();
export const queryWithAttachmentsSchema=querySchema.extend({attachmentIds:z.array(z.string().uuid()).max(4).refine(ids=>new Set(ids).size===ids.length).optional()}).refine(input=>!input.evidenceIds||!input.anchorEvidenceIds,{message:"Choose reference records or a strict evidence selection"});
export const insightSchema=z.object(scopeFields).strict().refine(validRange,{message:'Invalid time range'});
export const insightRequestSchema=z.object({...scopeFields,modelProfileId:modelProfileIdSchema.optional(),prompt:z.string().trim().max(8000).optional()}).strict().refine(validRange,{message:'Invalid time range'});
export type QueryRequest=z.output<typeof queryWithAttachmentsSchema>;
