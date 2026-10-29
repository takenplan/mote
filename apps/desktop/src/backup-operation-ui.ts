import type {BackgroundJob,BackupFileIdentity} from './contracts/operations';
import {showBackupOperation} from './settings-workspace';
import {appendDiagnostic} from './ui-diagnostic';

/** A display ticket for this picker call, never a saved retry target. */
export function createBackupOperationUi(root:Document=document){
  type Visit={kind:'import'|'export';startedAt:number;priorStartedAt?:number;phase:'working'|'canceled'|'complete'|'error';message:string;file?:BackupFileIdentity};
  let current:Visit|undefined;
  function paint(visit:Visit){if(current===visit)showBackupOperation(visit.kind,visit.phase,visit.message,root,visit.file);}
  return {
    begin(kind:Visit['kind'],message:string,jobs:BackgroundJob[]=[]){
      const visit:Visit={kind,phase:'working',message,startedAt:Date.now(),priorStartedAt:jobs.find(job=>job.id===`mote:${kind}-queue`)?.startedAt};current=visit;paint(visit);return visit;
    },
    update(jobs:BackgroundJob[]){
      const visit=current;if(!visit||visit.phase!=='working')return;
      const job=jobs.find(job=>job.id===`mote:${visit.kind}-queue`&&job.startedAt>=visit.startedAt&&job.startedAt!==visit.priorStartedAt);
      if(job?.file){visit.file=job.file;paint(visit);}
    },
    finish(visit:Visit,phase:Visit['phase'],message:string,file?:BackupFileIdentity,diagnostic?:string){
      if(current!==visit)return;
      visit.phase=phase;visit.message=message;visit.file=phase==='canceled'?undefined:file??visit.file;paint(visit);
      if(diagnostic)appendDiagnostic(root.getElementById('backup-operation')!,diagnostic);
    },
  };
}
