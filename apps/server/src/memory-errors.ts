import {StoreError} from './execution-storage.js';
import {memoryValidationInstruction,type MemoryOutputValidationCode,type MemoryValidationDetails} from './memory-validation.js';
export {type MemoryOutputValidationCode,type MemoryValidationDetails} from './memory-validation.js';
/** Feedback contains only host-owned instructions and numeric locations, never model text. */
export class MemoryOutputValidationError extends StoreError {
  constructor(public code:MemoryOutputValidationCode,message:string,public details:MemoryValidationDetails={}){super(message,502);this.name='MemoryOutputValidationError';}
  get repairInstruction(){return memoryValidationInstruction(this.code,this.details);}
}
