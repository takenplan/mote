import { z } from 'zod';
import { actionZone } from '@mote/shared';

/** Discovery policy is file configuration. Device review grants remain domain authorization state. */
export const actionsRuntimeSettingsSchema = z.object({ enabled: z.boolean().default(false), timeZone: actionZone.default('Asia/Shanghai') }).strict();
export type ActionsRuntimeSettings = z.infer<typeof actionsRuntimeSettingsSchema>;
