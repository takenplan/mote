import {z} from 'zod';

export const todoFields={title:z.string().trim().min(1).max(200),description:z.string().max(4000).default(''),dueAt:z.string().datetime({offset:true}).nullable().default(null),evidenceIds:z.array(z.string().uuid()).max(30).default([])};
const fields=todoFields;
export const todoInput=z.object({id:z.string().uuid().optional(),...fields}).strict();
export const archivedTodoSchema=z.object({...fields,id:z.string().uuid(),version:z.number().int().positive(),status:z.enum(['open','completed','cancelled']),createdAt:z.string().datetime({offset:true}),updatedAt:z.string().datetime({offset:true}),requestHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type Todo={id:string;version:number;title:string;description:string;dueAt:string|null;status:'open'|'completed'|'cancelled';evidenceIds:string[];createdAt:string;updatedAt:string};
