import type {FileProcessor} from './file-processors.js';
/** Registry defaults are execution inputs, not mutations of the saved YAML. */
export function effectiveProcessorParameters<T extends Record<string,unknown>>(processor:Pick<FileProcessor,'parameters'>,parameters:T):T {
  const defaults=Object.fromEntries((processor.parameters??[]).filter(parameter=>parameter.default!==undefined).map(parameter=>[parameter.key,parameter.default]));
  return {...defaults,...parameters} as T;
}
