import {z} from 'zod';
import {calendarDraftSchema} from '@mote/shared';

/** Runtime file failures must report an already committed permission withdrawal. */
export class ActionSettingsSaveError extends Error {
  constructor(readonly code:string,readonly statusCode:number,readonly revokedDeviceIds:string[],readonly authorizationRevision:number,readonly revision:number|undefined){super('Action authorization was revoked; refresh the settings before retrying');this.name='ActionSettingsSaveError';}
}
export const proposedSchema=z.object({actions:z.array(z.object({kind:z.enum(['calendar.create','calendar.update','calendar.cancel','calendar.complete']),event:calendarDraftSchema,uncertainty:z.string().max(2000),evidence:z.array(z.object({id:z.string().uuid(),quote:z.string().min(1).max(2000)}).strict()).min(1).max(20),sameAs:z.string().uuid().nullable()}).strict()).max(8)}).strict();
