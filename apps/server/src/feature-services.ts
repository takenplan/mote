/** Explicit legacy feature dependencies; no runtime dependency on the fixture composition.
 * Kept type-checked by test/fixtures/legacy-app.ts until domains move to ScopedServices. */
import type { OwnerQuestions } from './owner-questions.js';
import type { MemoryRecipeSettings } from './memory-recipe-settings.js';
import type { ContextReader, QueryInput } from '@mote/agent';
import type { CaptureInput, QueryResult } from '@mote/shared';
import type Fastify from 'fastify';
import type {FastifyRequest} from 'fastify';
import type { z } from 'zod';
import type { Actions } from './actions.js';
import type { ActivityProjection } from './activity.js';
import type { DelegationRuntime } from './delegation-runtime.js';
import type { DelegatedQueryRuns } from './delegated-query-runs.js';
import type { QueryQualityStrategy } from './query-quality-experiment.js';
import type { ArchivedFileStore } from './archived-files.js';
import type { ConcurrencyGate } from './concurrency.js';
import type { Config } from './config.js';
import type { ConfigService } from './config-service.js';
import type { Connections } from './connections.js';
import type { ContentStorageService } from './content-storage.js';
import type { Conversations } from './conversations.js';
import type { ServerDiagnostics } from './diagnostics.js';
import type { EvidenceReader } from './evidence-reader.js';
import type { ExecutionEngine } from './execution-engine.js';
import type { ExecutionSettings } from './execution-settings.js';
import type { ServerFeatureHost } from './feature-host.js';
import type { FileEvidence } from './file-evidence.js';
import type { FileProcessing, TranscriptionProvider } from './file-processing.js';
import type { registerFileRoutes } from './file-routes.js';
import type { FileStore } from './files.js';
import type { ImportStore, ImportPreparation, ImportPreparationResult } from './imports.js';
import type { Indexer } from './indexer.js';
import type { IngressService } from './ingress.js';
import type { InsightRuns } from './insight-runs.js';
import type { MemoryIntegrationSettings } from './memory-integration-settings.js';
import type { MaintenanceWorker } from './maintenance.js';
import type { MaterialMemoryWork } from './material-memory-work.js';
import type { MaterialOrganizerRuntime } from './material-organizers.js';
import type { MaterialStore } from './materials.js';
import type { MediaAssets } from './media-assets.js';
import type { MemoryLifecycle, LifecycleExtension } from './memory-lifecycle.js';
import type { MemoryStrategies } from './memory-strategies.js';
import type { MemoryReviewStrategy } from './memory-strategy-contract.js';
import type { MemoryPipeline } from './memory-pipeline.js';
import type { MemoryAutomation } from './memory-automation.js';
import type { PluginCenter } from './plugin-center.js';
import type { MemoryBindings } from './memory-bindings.js';
import type { MemoryPublication } from './memory-publication.js';
import type { MemoryAdapters } from './memory-adapters.js';
import type { ReloadableAgent, ModelAgentFactory } from './model-agent.js';
import type { ModelSettingsStore } from './model-settings.js';
import type { ImageProcessing } from './image-processing.js';
import type { ProcessingRuntime } from './processing-runtime.js';
import type { ProviderAdmission } from './provider-admission.js';
import type { QueryScope } from './query-scope.js';
import type { SourcePipelineRuntime } from './source-pipelines.js';
import type { SourceStore } from './sources.js';
import type { Store } from './store.js';
import type { UsageLedger } from './usage.js';
import type { WorkingMemory } from './working-memory.js';
import type {QueryAgent} from './query-agent.js';
declare function parseCaptureBundle(body:unknown):CaptureInput[];
export interface FeatureServices {
        configService: ConfigService;
        memoryBindings: MemoryBindings;
        memoryPublication: MemoryPublication;
        ownerQuestions: OwnerQuestions;
        automaticMemoryScheduling: boolean;
        activity: ActivityProjection;
        delegation: DelegationRuntime;
        memoryDelegation: {
            plan: (candidates: import("./material-memory-work.js").MemoryWorkCandidate[]) => Promise<import("./material-memory-work.js").MemoryWorkProposal[]>;
            onCreated: (proposal: import("./material-memory-work.js").MemoryWorkProposal, job: {
                id: string;
            }) => void;
            reconcile: () => void;
            close(): Promise<void>;
        };
        connectionIdentity: (req: FastifyRequest) => {
            hash: string;
            id: string;
            createdAt: string;
            scope: "owner" | "mcp-read" | "mcp-write";
            label: string;
            serverUrl: string;
            deviceId?: string | undefined;
            platform?: "other" | "macos" | "windows" | "linux" | "android" | undefined;
            deviceName?: string | undefined;
            revokedAt?: string | undefined;
            expiresAt?: string | undefined;
            writeSourceIds?: string[] | undefined;
        } | undefined;
        assertRequestActive: (req: FastifyRequest) => void;
        memoryIntegrationSettings: MemoryIntegrationSettings;
        memoryRecipeSettings: MemoryRecipeSettings;
        setPlaybackAuthorization: (authorize: ReturnType<typeof registerFileRoutes>) => void;
        connectors: import("./connectors/registry.js").ConnectorRegistry;
        processing: FileProcessing;
        executor: ExecutionEngine;
        agentFeatures: {
            registry: import("@mote/shared").FeatureRegistry<Function>;
            reader: ContextReader;
            registerTools: (featureId: string, contributions: import("@mote/agent").ContextToolContribution[]) => import("@deepseek-ai/cordis").Fiber & PromiseLike<import("@deepseek-ai/cordis").Fiber>;
            dispose: (id: string) => Promise<void>;
        };
        archiveReader: ContextReader;
        isClosing: () => boolean;
        actions: Actions;
        agent: ReloadableAgent;
        agentGate: ConcurrencyGate;
        archivedFiles: ArchivedFileStore;
        codex: {
            executable: string | undefined;
            home: string | undefined;
        };
        config: Config;
        connections: Connections;
        contentStorage: ContentStorageService;
        conversations: Conversations;
        credential: (req: FastifyRequest) => {
            hash: string;
            id: string;
            createdAt: string;
            scope: "owner" | "mcp-read" | "mcp-write";
            label: string;
            serverUrl: string;
            deviceId?: string | undefined;
            platform?: "other" | "macos" | "windows" | "linux" | "android" | undefined;
            deviceName?: string | undefined;
            revokedAt?: string | undefined;
            expiresAt?: string | undefined;
            writeSourceIds?: string[] | undefined;
        } | undefined;
        diagnosticSnapshot: () => {
            execution: {
                failureReceipts: {
                    writeFailures: number;
                };
                agents: {
                    active: number;
                    waiting: number;
                    limit: number;
                };
                llm: {
                    active: number;
                    waiting: number;
                    limit: number;
                };
                interactive: {
                    active: number;
                    waiting: number;
                    limit: number;
                };
                interactiveHarness: {
                    active: number;
                    waiting: number;
                    limit: number;
                };
                delegated: {
                    [k: string]: {
                        limit: number;
                        running: number;
                        waiting: number;
                    };
                };
            };
            services: {
                agentConfigured: boolean;
                embeddingConfigured: boolean;
                activeQueries: number;
                closing: boolean;
            };
            queue: {
                index: {
                    pending: number;
                    failed: number;
                    indexed: number;
                    textReady: number;
                };
                devices: number;
                reportedPending: number;
            };
            storage: {
                captures: number;
                imageCaptures: number;
                blobs: number;
                bytes: any;
                logicalBytes: number;
                maxBytes: number | null;
                imagesEncrypted: boolean;
            };
            enabled: boolean;
            level: import("./diagnostics.js").LogLevel;
            instanceId: `${string}-${string}-${string}-${string}-${string}`;
            retainedEvents: number;
            lastSeq: number;
            pendingWrites: number;
            droppedEvents: number;
            writeFailures: number;
            readFailures: number;
            agentTrace: {
                enabled: boolean;
                retainedEvents: number;
            };
            limits: {
                maxFileBytes: number;
                maxFiles: number;
                maxEvents: number;
            };
            runtime: {
                uptimeMs: number;
                rssBytes: number;
                cpuUserMicros: number;
                cpuSystemMicros: number;
            };
            version: number;
            scope: string;
        };
        diagnostics: ServerDiagnostics;
        eventLoop: import("perf_hooks").IntervalHistogram;
        evidenceReader: EvidenceReader;
        fileEvidence: FileEvidence;
        files: FileStore;
        importTasks: Map<string, Promise<unknown>>;
        imports: ImportStore;
        indexer: Indexer;
        ingress: IngressService;
        insight: (range: QueryScope & {
            prompt?: string;
            modelProfileId?: string;
        }, onProgress?: QueryInput["onProgress"], signal?: AbortSignal, operationId?: string, snapshot?: import("@mote/shared").InsightSnapshot) => Promise<{
            snapshot?: import("@mote/shared").InsightSnapshot;
            imageReadReceipts?: {
                id: string;
                imageView: import("@mote/shared").ImageView;
            }[];
            evidenceDependencies?: import("@mote/shared").EvidenceDependencies;
            sourceContextDependencies?: import("@mote/shared").SourceContextDeclaration[];
            configuration?: import("@mote/shared/models").ModelConfigurationReceipt;
            modelSelection?: import("@mote/shared/models").ModelSelection;
            usage?: import("@mote/shared").UsageReceipt;
            answer: string;
            citations: {
                id: string;
                capturedAt: string;
                appName: string;
                excerpt: string;
            }[];
            trace: {
                tool: string;
                arguments: unknown;
                count: number;
                imageView?: import("@mote/shared").ImageViewTrace;
            }[];
            runId: string;
            artifact?: import("./insights.js").InsightArtifact;
        }>;
        insightRequestSchema: z.ZodEffects<z.ZodObject<{
            modelProfileId: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"env:deployment">]>>;
            prompt: z.ZodOptional<z.ZodString>;
            after: z.ZodOptional<z.ZodString>;
            before: z.ZodOptional<z.ZodString>;
            deviceId: z.ZodOptional<z.ZodString>;
            timeZone: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        }, "strict", z.ZodTypeAny, {
            timeZone?: string | undefined;
            deviceId?: string | undefined;
            after?: string | undefined;
            before?: string | undefined;
            prompt?: string | undefined;
            modelProfileId?: string | undefined;
        }, {
            timeZone?: string | undefined;
            deviceId?: string | undefined;
            after?: string | undefined;
            before?: string | undefined;
            prompt?: string | undefined;
            modelProfileId?: string | undefined;
        }>, {
            timeZone?: string | undefined;
            deviceId?: string | undefined;
            after?: string | undefined;
            before?: string | undefined;
            prompt?: string | undefined;
            modelProfileId?: string | undefined;
        }, {
            timeZone?: string | undefined;
            deviceId?: string | undefined;
            after?: string | undefined;
            before?: string | undefined;
            prompt?: string | undefined;
            modelProfileId?: string | undefined;
        }>;
        insightRuns: InsightRuns;
        interactiveGate: ConcurrencyGate;
        interactiveModelGate: ConcurrencyGate;
        jobId: (params: unknown) => string;
        launchImport: (id: string, task: () => Promise<unknown>) => void;
        lifecycle: MemoryLifecycle;
        llmGate: ConcurrencyGate;
        maintenanceWorker: MaintenanceWorker | undefined;
        materialOrganizer: MaterialOrganizerRuntime;
        materialMemoryWork: MaterialMemoryWork;
        materials: MaterialStore;
        mediaAssets: MediaAssets;
        mediaRange: z.ZodEffects<z.ZodObject<{
            after: z.ZodOptional<z.ZodString>;
            before: z.ZodOptional<z.ZodString>;
            deviceId: z.ZodOptional<z.ZodString>;
            appId: z.ZodOptional<z.ZodString>;
            collection: z.ZodOptional<z.ZodEnum<["content", "activity"]>>;
            appVisibility: z.ZodOptional<z.ZodEnum<["foreground", "background", "unknown"]>>;
            screenLocked: z.ZodOptional<z.ZodEffects<z.ZodEnum<["true", "false"]>, boolean, "false" | "true">>;
            playbackType: z.ZodOptional<z.ZodEnum<["local", "remote", "unknown"]>>;
        }, "strict", z.ZodTypeAny, {
            deviceId?: string | undefined;
            appId?: string | undefined;
            after?: string | undefined;
            before?: string | undefined;
            collection?: "content" | "activity" | undefined;
            appVisibility?: "unknown" | "background" | "foreground" | undefined;
            playbackType?: "unknown" | "local" | "remote" | undefined;
            screenLocked?: boolean | undefined;
        }, {
            deviceId?: string | undefined;
            appId?: string | undefined;
            after?: string | undefined;
            before?: string | undefined;
            collection?: "content" | "activity" | undefined;
            appVisibility?: "unknown" | "background" | "foreground" | undefined;
            playbackType?: "unknown" | "local" | "remote" | undefined;
            screenLocked?: "false" | "true" | undefined;
        }>, {
            deviceId?: string | undefined;
            appId?: string | undefined;
            after?: string | undefined;
            before?: string | undefined;
            collection?: "content" | "activity" | undefined;
            appVisibility?: "unknown" | "background" | "foreground" | undefined;
            playbackType?: "unknown" | "local" | "remote" | undefined;
            screenLocked?: boolean | undefined;
        }, {
            deviceId?: string | undefined;
            appId?: string | undefined;
            after?: string | undefined;
            before?: string | undefined;
            collection?: "content" | "activity" | undefined;
            appVisibility?: "unknown" | "background" | "foreground" | undefined;
            playbackType?: "unknown" | "local" | "remote" | undefined;
            screenLocked?: "false" | "true" | undefined;
        }>;
        memories: import("./memory.js").MemoryStore;
        memoryPipeline: MemoryPipeline;
        modelSettings: ModelSettingsStore;
        parseCaptureBundle: typeof parseCaptureBundle;
        perception: ImageProcessing;
        providerAdmission: ProviderAdmission;
        queryAgent: (input: QueryInput, operation?: "query" | "insight", moduleId?: string, usageOwner?: "query" | "caller") => Promise<{
            usage?: import("@mote/shared").UsageReceipt;
            configuration: import("@mote/shared/models").ModelConfigurationReceipt;
            sourceContextDependencies?: import("@mote/shared").SourceContextDeclaration[];
            evidenceDependencies?: import("@mote/shared").EvidenceDependencies;
            imageReadReceipts?: {
                id: string;
                imageView: import("@mote/shared").ImageView;
            }[];
            snapshot?: import("@mote/shared").InsightSnapshot;
            modelSelection?: import("@mote/shared/models").ModelSelection;
            answer: string;
            citations: {
                id: string;
                capturedAt: string;
                appName: string;
                excerpt: string;
            }[];
            trace: {
                tool: string;
                arguments: unknown;
                count: number;
                imageView?: import("@mote/shared").ImageViewTrace;
            }[];
            runId: string;
        }>;
        queryRuns: DelegatedQueryRuns;
        queryWithAttachmentsSchema: z.ZodObject<{
            modelProfileId: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodLiteral<"env:deployment">]>>;
            modelOverride: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
            question: z.ZodString;
            conversationId: z.ZodOptional<z.ZodString>;
            after: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            before: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            deviceId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
            timeZone: z.ZodNullable<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>>;
        } & {
            attachmentIds: z.ZodOptional<z.ZodEffects<z.ZodArray<z.ZodString, "many">, string[], string[]>>;
        }, "strict", z.ZodTypeAny, {
            question: string;
            timeZone?: string | null | undefined;
            deviceId?: string | null | undefined;
            after?: string | null | undefined;
            before?: string | null | undefined;
            modelProfileId?: string | undefined;
            modelOverride?: string | undefined;
            conversationId?: string | undefined;
            attachmentIds?: string[] | undefined;
        }, {
            question: string;
            timeZone?: string | null | undefined;
            deviceId?: string | null | undefined;
            after?: string | null | undefined;
            before?: string | null | undefined;
            modelProfileId?: string | undefined;
            modelOverride?: string | undefined;
            conversationId?: string | undefined;
            attachmentIds?: string[] | undefined;
        }>;
        reviewExtraction: (input: QueryInput, result: QueryResult, strategy?: MemoryReviewStrategy, draftOrigin?: import("./memory-review.js").MemoryDraftOrigin) => Promise<QueryResult>;
        runtimeSettings: ExecutionSettings;
        semanticSelection: () => {
            configured: boolean;
            owner: "models";
            fingerprint: string;
            revision: number;
            profileId: string;
            provider: string;
            model: string;
        };
        serverVersion: string;
        softwareUpdate: {
            status: () => import("./updates.js").UpdateStatus;
            check: () => Promise<import("./updates.js").UpdateStatus>;
            close: () => Promise<void>;
        };
        sourceOwner: (req: FastifyRequest, id: string) => void;
        sourcePipelines: SourcePipelineRuntime;
        sources: SourceStore;
        store: Store;
        usageLedger: UsageLedger;
        webVersion: string | null;
        workflows: ProcessingRuntime;

}
