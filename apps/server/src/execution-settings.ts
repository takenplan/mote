import {z} from 'zod';
import {ConfigService} from './config-service.js';
export const executionSettingsSchema=z.object({interactiveConcurrency:z.number().int().min(1).max(8).default(2),agentConcurrency:z.number().int().min(1).max(64).default(8),llmConcurrency:z.number().int().min(1).max(64).default(4),memoryConcurrency:z.number().int().min(1).max(16).default(3)}).strict();
export const diagnosticsSettingsSchema=z.object({enabled:z.boolean().default(true),debug:z.boolean().default(false),traceEnabled:z.boolean().default(false),level:z.enum(['debug','info','warn','error','silent']).default('info')}).strict();
export type ExecutionSettingsValue=z.infer<typeof executionSettingsSchema>;
export type DiagnosticsSettingsValue=z.infer<typeof diagnosticsSettingsSchema>;
const revision=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const executionUpdateSchema=executionSettingsSchema.extend({revision}).strict();
const diagnosticsUpdateSchema=diagnosticsSettingsSchema.extend({revision}).strict();
/** These domains share the authoritative YAML file and revision. SQLite settings are business state only. */
export class ExecutionSettings {
  constructor(private service:ConfigService){}
  execution(){const {interactiveConcurrency,agentConcurrency,llmConcurrency,memoryConcurrency}=this.service.current<ExecutionSettingsValue>('execution');return {interactiveConcurrency,agentConcurrency,llmConcurrency,memoryConcurrency};}
  diagnostics(){const {enabled,debug,traceEnabled,level}=this.service.current<DiagnosticsSettingsValue>('diagnostics');return {enabled,debug,traceEnabled,level};}
  executionView(){return {...this.execution(),revision:this.service.revision};}
  diagnosticsView(){return {...this.diagnostics(),revision:this.service.revision};}
  async saveExecution(raw:unknown){const {revision,...value}=executionUpdateSchema.parse(raw);await this.service.update('execution',{...this.service.saved<Record<string,unknown>>('execution'),...value},revision);return this.executionView();}
  async saveDiagnostics(raw:unknown){const {revision,...value}=diagnosticsUpdateSchema.parse(raw);await this.service.update('diagnostics',{...this.service.saved<Record<string,unknown>>('diagnostics'),...value},revision);return this.diagnosticsView();}
}
