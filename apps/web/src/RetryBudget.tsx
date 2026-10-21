import type {ExecutionRetryBudget} from '@mote/shared';
import {moteText} from '@mote/shared/i18n';

/** Existing task views share the host's count; resource waits and historical
 * unknown results do not invent another failure or a confirmation request. */
export function RetryBudget({value}:{value:Partial<ExecutionRetryBudget>}){
 if(value.maxRetries===undefined)return null;
 return <span>{value.retriesUsed===undefined||value.retriesUsed>value.maxRetries?moteText('当前最多自动重试 {0} 次',value.maxRetries):moteText('自动重试 {0}/{1}',value.retriesUsed,value.maxRetries)}{value.retryExhausted&&<> · {moteText('自动重试次数已用完')}</>}</span>;
}
