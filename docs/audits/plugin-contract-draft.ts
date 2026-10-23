/** Planning-only types. Not exported by @mote/shared and not loaded by any host.
 * Extend the existing manifest/recipe/registries during a future implementation;
 * do not introduce another task, data, authorization or plugin registry.
 */
export type VersionedRef = {id: string; version: string};
export type DataShape = {kind: string; schemaVersion: number; representation: string};
export type CapabilityRequirement = VersionedRef & {host: 'collector'|'server'|'web'|'android'};
export type ProductPort = DataShape & {name: string; optional?: boolean};
export type ProductBinding = {input: string; from: {step: string; output: string}};
export type ComponentExtension = {
  id: string; version: string;
  surface: 'ingress'|'processing'|'data'|'collection'|'renderer'|'panel'|'page'|'command';
  requires?: CapabilityRequirement[];
  consumes?: ProductPort[];
  produces?: ProductPort[];
  effects?: Array<'read-scoped-evidence'|'derive'|'publish-draft'|'owner-command'>;
};
export type CatalogContribution = {
  id: string;
  component: VersionedRef; // existing server data component, scoped reader implementation
  accepts: DataShape[];
  ui: {collection?: string; card?: string; detail?: string; panels?: string[]; actions?: string[]};
};
export type ManifestExtension = {
  schemaVersion: 2; id: string; version: string;
  components: ComponentExtension[];
  catalogs?: CatalogContribution[];
};
export type RecipeStepExtension = {
  id: string; use: VersionedRef; dependsOn: string[];
  inputs: ProductBinding[];
  outputs: ProductPort[];
};
// Material named products and EvidenceArchive objects have different authorities.
// They are references, never aliases that let a consumer bypass a reader or grant.
export type ProductRef =
  | {store: 'material'; ref: string; key: string; fingerprint: string; blockIds?: string[]}
  | {store: 'evidence-archive'; id: string; revision: string};
export type CatalogEntry = {
  logicalKey: string; // host-created reference identity, excludes revision and presentation ID
  ref: string; // selected immutable revision where the authority supports revisions
  shape: DataShape; title: string;
  origin: {sourceId: string; externalId: string};
  products: Array<{name: string; state: 'ready'|'pending'|'failed'|'unavailable'; ref?: ProductRef}>;
  indexing: 'disabled'|'pending'|'running'|'indexed'|'failed';
};
export type CatalogPage = {items: CatalogEntry[]; nextCursor: string|null; truncated: boolean};
export type RegistrationPin = VersionedRef & {installationEpoch: string};
export type WindowStateRef = {id: string; revision: string};
export type FlowSnapshot = {inputs: ProductRef[]; checkpoint: string; watermark?: string};
export type FlowPlan = {
  groups: Array<{logicalObject: string; outputSlot: string; inputRefs: ProductRef[]}>;
  nextState?: WindowStateRef;
};
/** Trusted implementations receive scoped refs and immutable config. Host persists
 * plans/checkpoints and creates durable work. No arbitrary SQL/Store is provided.
 */
export interface FlowPolicy {
  id: string; version: string;
  plan(input: {snapshot: FlowSnapshot; state?: WindowStateRef; config: Readonly<Record<string,unknown>>; signal: AbortSignal}): Promise<FlowPlan>;
}

export const generatedExample = {
  schemaVersion: 2, id: 'fixture.journal', version: '1',
  components: [
    {id:'fixture.journal-reader',version:'1',surface:'data',produces:[{name:'conversation',kind:'fixture.journal',schemaVersion:1,representation:'markdown'}]},
    {id:'fixture.outline',version:'1',surface:'processing',consumes:[{name:'conversation',kind:'fixture.journal',schemaVersion:1,representation:'markdown'}],produces:[{name:'outline',kind:'fixture.outline',schemaVersion:1,representation:'markdown'}],effects:['read-scoped-evidence','derive']},
    {id:'collection:fixture.journal',version:'1',surface:'collection',requires:[{host:'server',id:'fixture.journal-reader',version:'1'}]},
  ],
  catalogs: [{id:'fixture.journal-catalog',component:{id:'fixture.journal-reader',version:'1'},accepts:[{kind:'fixture.journal',schemaVersion:1,representation:'markdown'}],ui:{collection:'fixture.journal',card:'fixture.journal-card',detail:'fixture.journal-detail'}}],
} satisfies ManifestExtension;
