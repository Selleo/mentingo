import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { loadEsm } from "load-esm";

import { AssistantExecutionService } from "../assistant-execution.service";

import { assistantWorkflowRunId } from "./assistant-run-id";
import { startAssistantRunTrace, withAssistantTrace } from "./assistant-tracing";
import { registerAssistantExecution } from "./assistant-workflow.bridge";

import type { AssistantRuntimeInput, AssistantWorkflowRunState } from "./assistant-workflow.types";
import type { OnApplicationBootstrap, OnApplicationShutdown } from "@nestjs/common";
import type { createWorld } from "@workflow/world-postgres";

type PostgresWorld = ReturnType<typeof createWorld>;
type WorkflowApi = {
  start(
    metadata: { workflowId: string },
    args: unknown[],
    options?: { world: PostgresWorld; namespace?: string },
  ): Promise<{ runId: string }>;
  getRun(runId: string): {
    exists: Promise<boolean>;
    status: Promise<Exclude<AssistantWorkflowRunState, "missing">>;
    cancel(): Promise<void>;
  };
};
type WorkflowBuilder = {
  NestLocalBuilder: new (options: {
    workingDir: string;
    dirs: string[];
    outDir: string;
    moduleType: "commonjs";
    distDir: string;
    sourcemap: false;
  }) => { build(): Promise<void> };
};
type FlowBundle = { POST(request: Request): Promise<Response> };

@Injectable()
export class AssistantRuntimeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private world?: PostgresWorld;
  private workflowId?: string;

  constructor(
    private readonly assistantExecutionService: AssistantExecutionService,
    private readonly configService: ConfigService,
  ) {}

  isAvailable() {
    return Boolean(this.world && this.workflowId);
  }

  async onApplicationBootstrap() {
    if (process.env.BUILD_VERIFICATION === "true") return;
    const connectionString = this.configService.getOrThrow<string>("database.urlApp");
    // Keep one trace per run by default, while respecting an explicit SDK trace mode.
    process.env.WORKFLOW_TRACE_MODE ??= "continuous";
    registerAssistantExecution(this.assistantExecutionService);
    if (process.env.NODE_ENV !== "production") {
      const { NestLocalBuilder } = await loadEsm<WorkflowBuilder>("@workflow/nest/builder");
      await new NestLocalBuilder({
        workingDir: process.cwd(),
        dirs: ["src/assistant/workflow"],
        outDir: resolve("dist/workflow"),
        moduleType: "commonjs",
        distDir: "dist/src/assistant/workflow",
        sourcemap: false,
      }).build();
    }
    const manifest = JSON.parse(await readFile(resolve("dist/workflow/manifest.json"), "utf8"));
    const entry = Object.values(
      manifest.workflows as Record<string, Record<string, { workflowId: string }>>,
    )
      .flatMap((file) => Object.entries(file))
      .find(([name]) => name === "assistantWorkflow")?.[1];
    if (!entry) throw new Error("Assistant workflow bundle is missing; run the API build");
    this.workflowId = entry.workflowId;
    const [{ createWorld }, { setWorld }] = await Promise.all([
      loadEsm<typeof import("@workflow/world-postgres")>("@workflow/world-postgres"),
      loadEsm<{ setWorld(world: PostgresWorld): void }>("workflow/runtime"),
    ]);
    this.world = createWorld({
      connectionString,
      queueConcurrency: 4,
      maxPoolSize: 6,
      jobPrefix: "mentingo_assistant_",
      applicationManagedShutdown: true,
    });
    setWorld(this.world);
    await loadEsm(pathToFileURL(resolve("dist/workflow/steps.mjs")).href);
    const flow = await loadEsm<FlowBundle>(
      pathToFileURL(resolve("dist/workflow/workflows.mjs")).href,
    );
    // Queue delivery stays inside this process. No unauthenticated workflow
    // HTTP routes are added to the Nest application or its reverse proxy.
    const namespace = process.env.WORKFLOW_QUEUE_NAMESPACE;
    const prefix = namespace ? `__${namespace}_wkf_workflow_` : "__wkf_workflow_";
    this.world.registerHandler(prefix, (request) => flow.POST(request));
    await this.world.start();
  }

  async start(input: AssistantRuntimeInput): Promise<{ workflowRunId: string }> {
    if (!this.isAvailable())
      throw new ServiceUnavailableException("Assistant runtime is not configured");
    const { start, getRun } = await loadEsm<WorkflowApi>("workflow/api");
    const workflowRunId = assistantWorkflowRunId(input);
    if (await getRun(workflowRunId).exists) return { workflowRunId };
    const observation = startAssistantRunTrace(input);
    const span = observation.otelSpan.spanContext();
    try {
      // World.createRunId is the supported per-start run identity hook. Pass a
      // scoped World view so concurrent starts never mutate the global factory.
      await withAssistantTrace(
        {
          ...input,
          trace: { traceId: span.traceId, spanId: span.spanId, traceFlags: span.traceFlags },
        },
        "core-assistant.enqueue",
        () =>
          start(
            { workflowId: this.workflowId! },
            [
              {
                runId: input.runId,
                tenantId: input.tenantId,
                userId: input.userId,
                threadId: input.threadId,
                trace: { traceId: span.traceId, spanId: span.spanId, traceFlags: span.traceFlags },
              },
            ],
            {
              world: { ...this.world!, createRunId: () => workflowRunId.slice(5) },
              namespace: process.env.WORKFLOW_QUEUE_NAMESPACE,
            },
          ),
      );
    } catch (error) {
      if (!(await getRun(workflowRunId).exists)) throw error;
    } finally {
      observation.end();
    }
    return { workflowRunId };
  }

  async getRunState(workflowRunId: string): Promise<AssistantWorkflowRunState> {
    if (!this.isAvailable())
      throw new ServiceUnavailableException("Assistant runtime is not configured");
    const { getRun } = await loadEsm<WorkflowApi>("workflow/api");
    const run = getRun(workflowRunId);
    // The SDK returns false only for WorkflowRunNotFoundError. Transport and
    // database errors must propagate, never masquerade as a missing run.
    if (!(await run.exists)) return "missing";
    return run.status;
  }

  async cancel(workflowRunId: string): Promise<void> {
    if (!this.isAvailable()) return;
    const { getRun } = await loadEsm<WorkflowApi>("workflow/api");
    await getRun(workflowRunId).cancel();
  }

  async onApplicationShutdown() {
    await this.world?.close?.();
    registerAssistantExecution(undefined);
  }
}
