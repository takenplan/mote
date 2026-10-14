import {z} from 'zod';
import {fileProcessingSchema,filePolicySchema} from '@mote/shared';
import {createDefaultFilePolicy} from './file-policy.js';
import {mediaRuntimeSettings,type MediaRuntimeSettings} from './media-configuration.js';

export const processingConfigurationSchema=z.object({settings:fileProcessingSchema,policy:filePolicySchema}).strict();
export type ProcessingConfiguration=z.infer<typeof processingConfigurationSchema>;
export function defaultProcessingConfiguration(input?:Partial<MediaRuntimeSettings>):ProcessingConfiguration {
  const media=mediaRuntimeSettings(input);
  return {settings:fileProcessingSchema.parse({localEndpoint:media.asrEndpoint,endpoint:media.asrEndpoint}),policy:createDefaultFilePolicy(undefined,media.asrEndpoint,media.ocrEndpoint)};
}
