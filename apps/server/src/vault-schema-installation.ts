import type {DatabaseSync} from 'node:sqlite';
import {vaultSchema} from './vault-schema.js';
import {captureSchema,captureProjectionSchema} from './capture-schema.js';
import {perceptionSchema} from './perception-schema.js';
import {sourceSchema} from './source-schema.js';
import {fileSchema} from './file-schema.js';
import {memoryStorageSchema} from './memory-storage-schema.js';
import {conversationSchema} from './conversation-schema.js';
import {insightSchema} from './insight-schema.js';
import {ensureTodoSchema} from './todo-schema.js';
import {initializeReadModels} from './read-models.js';
import {initializeSourceCatalog} from './source-catalog.js';

type SchemaOwner='vault'|'capture'|'perception'|'source'|'file'|'memory'|'conversation'|'insight'|'todo'|'capture-projections'|'capture-read-models'|'source-catalog';
type Installation={owner:SchemaOwner;requires:readonly SchemaOwner[];install:(db:DatabaseSync)=>void};

/** The current vault's fixed startup inventory, not optional feature installation.
 * Definitions stay with their domain owners. Dependencies describe table/trigger
 * prerequisites, rather than runtime service dependencies. Feature-owned tables
 * (Material, execution, Memory indexes, conversation turns, etc.) remain with
 * their existing constructors and must finish installing before app.ready(). */
export const vaultSchemaInstallations:readonly Installation[]=[
 {owner:'vault',requires:[],install:vaultSchema},
 {owner:'capture',requires:[],install:captureSchema},
 {owner:'perception',requires:['capture'],install:perceptionSchema},
 {owner:'source',requires:['capture'],install:sourceSchema},
 {owner:'file',requires:['capture','source'],install:fileSchema},
 {owner:'memory',requires:[],install:memoryStorageSchema},
 {owner:'conversation',requires:[],install:conversationSchema},
 {owner:'insight',requires:[],install:insightSchema},
 {owner:'todo',requires:[],install:ensureTodoSchema},
 {owner:'capture-projections',requires:['capture'],install:captureProjectionSchema},
 {owner:'capture-read-models',requires:['capture'],install:initializeReadModels},
 {owner:'source-catalog',requires:['capture','source'],install:initializeSourceCatalog},
];

/** EvidenceStore registers the SQL functions and enables foreign keys first.
 * All core constraints/projections are installed before the store escapes its
 * constructor; the server finishes feature installation before accepting input.
 * IF NOT EXISTS preserves the current schema and persisted identities on restart.
 * This is current-format installation only; epoch validation precedes this call. */
export function installVaultSchema(db:DatabaseSync){
 const installed=new Set<SchemaOwner>();
 for(const item of vaultSchemaInstallations){
  for(const dependency of item.requires)if(!installed.has(dependency))throw new Error(`${item.owner} schema requires ${dependency} first`);
  item.install(db);installed.add(item.owner);
 }
}
