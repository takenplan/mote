/** The HTTP entrypoint chooses no tables: each domain resolves and deletes its own identities. */
export class EvidenceDeletion {
 constructor(private captures:{delete(id:string):{deleted:number}},private files:{captureForEvidence(id:string):string|undefined;forget(id:string):{deleted:number}}){}
 delete(id:string){const file=this.files.captureForEvidence(id);return file?this.files.forget(file):this.captures.delete(id);}
}
