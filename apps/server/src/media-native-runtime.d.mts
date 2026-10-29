export interface PreparedMediaRuntime {python:string;version:string;generation:string;created:boolean}
export function prepareNativeMediaRuntime(options:{repository:string;directory:string;signal?:AbortSignal;allowInstall?:boolean;sourcePython?:string;onStage?:(stage:'dependencies'|'verifying_dependencies')=>void;env?:NodeJS.ProcessEnv}):Promise<PreparedMediaRuntime>;
