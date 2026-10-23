import "reflect-metadata";

import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// No provider or application DB calls: run compiled WorkflowAgent through the durable local World.
const dataDir = await mkdtemp(join(tmpdir(), "mentingo-assistant-workflow-"));
process.env.WORKFLOW_LOCAL_DATA_DIR = dataDir;
process.env.WORKFLOW_TARGET_WORLD = "local";
process.env.WORKFLOW_TRACE_MODE = "continuous";
const { NodeTracerProvider, SimpleSpanProcessor, InMemorySpanExporter } = await import(
  "@opentelemetry/sdk-trace-node"
);
const exporter = new InMemorySpanExporter();
const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
provider.register();
const { setLangfuseTracerProvider } = await import("@langfuse/tracing");
setLangfuseTracerProvider(provider);
const require = createRequire(import.meta.url);
const { PERMISSIONS } = require("@repo/shared");

const { validateAssistantOutcome } = require("../dist/src/assistant/workflow/assistant-outcome.js");
const { assistantWorkflowRunId } = require("../dist/src/assistant/workflow/assistant-run-id.js");
const { withAssistantTrace } = require("../dist/src/assistant/workflow/assistant-tracing.js");
const workflowInput = {
  runId: "fixture-run",
  tenantId: "fixture-tenant",
  userId: "fixture-user",
  threadId: "fixture-thread",
  createdAt: new Date().toISOString(),
};
const workflowRunId = assistantWorkflowRunId(workflowInput);
const {
  registerAssistantExecution,
} = require("../dist/src/assistant/workflow/assistant-workflow.bridge.js");
const { McpHttpService } = require("../dist/src/mcp/mcp-http.service.js");
// Exercise the production native tool catalog through the real step serializer.
// Domain adapters are registered only; these mocks cannot make provider/DB calls.
const nativeReadService = Object.assign(Object.create(McpHttpService.prototype), {
  callContext: new AsyncLocalStorage(),
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ email: "fixture@example.test" }] }) }),
    }),
  },
  tenantDbRunnerService: { runWithTenant: async (_tenantId, callback) => callback() },
  permissionsService: {
    getUserAccess: async () => ({ permissions: Object.values(PERMISSIONS), roleSlugs: [] }),
  },
  settingsService: { getGlobalSettings: async () => ({}) },
});
const nativeReadTools = await nativeReadService.listNativeReadTools(
  "fixture-user",
  "fixture-tenant",
  "https://fixture.example.test",
);
assert.ok(nativeReadTools.some((definition) => definition.name === "global_search"));

const scenario = process.env.ASSISTANT_SMOKE_SCENARIO ?? "grounded";
assert.ok(["grounded", "repair-greeting", "reject-facts"].includes(scenario));
const responseText =
  scenario === "repair-greeting" ? "Hej! Jak mogę pomóc?" : "Here is your learning plan.";
const rejectedText =
  scenario === "repair-greeting"
    ? "First unsupported greeting proposal"
    : "Unsupported factual proposal";
const checkpoints = [];
const activities = [];
const validations = [];
let completed;
let failed;
let calls = 0;
let toolCalls = 0;
let repairFeedbackSeen = false;
const evidence = () => ({ successfulToolCalls: toolCalls, readableToolCalls: 0 });
registerAssistantExecution({
  loadContext: async () => ({
    run: {
      language: scenario === "repair-greeting" ? "pl" : "en",
      userId: "fixture-user",
      threadId: "fixture-thread",
    },
    messages: [
      { role: "user", content: scenario === "repair-greeting" ? "hej co tam" : "Help me learn" },
    ],
    tools: [
      ...nativeReadTools,
      {
        name: "get_profile",
        description: "Read profile",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  }),
  getModel: async () => ({
    specificationVersion: "v4",
    provider: "smoke",
    modelId: "fixture",
    supportedUrls: {},
    doStream: async (options) => {
      calls += 1;
      assert.equal(options.toolChoice?.type, "required");
      if (scenario === "repair-greeting" && calls === 2) {
        assert.ok(JSON.stringify(options.prompt).includes("NO_VERIFIED_EVIDENCE"));
        repairFeedbackSeen = true;
      }
      const readFirst = scenario === "grounded" && calls === 1;
      const kind = scenario === "repair-greeting" && calls > 1 ? "conversation" : "answer";
      const text =
        scenario === "grounded" || (scenario === "repair-greeting" && calls > 1)
          ? responseText
          : rejectedText;
      const outcome = { kind, requiresReadableContent: false, text };
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "stream-start", warnings: [] });
            // Unstructured prefaces must never be persisted as final replies.
            controller.enqueue({ type: "text-start", id: "text" });
            controller.enqueue({ type: "text-delta", id: "text", delta: "Unstructured preface" });
            controller.enqueue({ type: "text-end", id: "text" });
            if (!readFirst) {
              const partialText = scenario === "grounded" ? "Here is your" : text.slice(0, 4);
              controller.enqueue({ type: "tool-input-start", id: "reply", toolName: "respond" });
              controller.enqueue({
                type: "tool-input-delta",
                id: "reply",
                delta: JSON.stringify({ ...outcome, text: partialText }).slice(0, -2),
              });
              controller.enqueue({
                type: "tool-input-delta",
                id: "reply",
                delta: `${text.slice(partialText.length)}"}`,
              });
              controller.enqueue({ type: "tool-input-end", id: "reply" });
            }
            controller.enqueue({
              type: "tool-call",
              toolCallId: `call-${calls}`,
              toolName: readFirst ? "get_profile" : "respond",
              input: readFirst ? "{}" : JSON.stringify(outcome),
            });
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "tool-calls", raw: "tool_calls" },
              usage: { inputTokens: { total: 2 }, outputTokens: { total: 5 } },
            });
            controller.close();
          },
        }),
      };
    },
  }),
  executeTool: async () => {
    toolCalls += 1;
    return { profile: "fixture" };
  },
  setActivity: async (_input, activity) => {
    activities.push(activity);
  },
  validateOutcome: async (_input, outcome) => {
    const result = validateAssistantOutcome(outcome, evidence());
    validations.push(result);
    return result;
  },
  checkpoint: async (_input, text, _sources, kind, requiresReadableContent) => {
    if (validateAssistantOutcome({ kind, text, requiresReadableContent }, evidence()).accepted)
      checkpoints.push(text);
  },
  complete: async (_input, text, _sources, kind, requiresReadableContent) => {
    const result = validateAssistantOutcome({ kind, text, requiresReadableContent }, evidence());
    assert.ok(result.accepted);
    completed = text;
    return result;
  },
  fail: async (_input, code) => {
    failed = code;
  },
});
const { getWorld, setWorld } = await import("workflow/runtime");
if (process.env.ASSISTANT_SMOKE_POSTGRES_URL) {
  const { createWorld } = await import("@workflow/world-postgres");
  setWorld(
    createWorld({
      connectionString: process.env.ASSISTANT_SMOKE_POSTGRES_URL,
      queueConcurrency: 2,
      applicationManagedShutdown: true,
      jobPrefix: "assistant_smoke_",
    }),
  );
}
const { start, getRun } = await import("workflow/api");
const world = await getWorld();
const deliveries = new Set();
const registerHandler = world.registerHandler.bind(world);
world.registerHandler = (prefix, handler) =>
  registerHandler(prefix, (request) => {
    const delivery = Promise.resolve().then(() => handler(request));
    deliveries.add(delivery);
    void delivery.then(
      () => deliveries.delete(delivery),
      () => deliveries.delete(delivery),
    );
    return delivery;
  });
let timer;
try {
  await import(pathToFileURL(resolve("dist/workflow/steps.mjs")).href);
  const flow = await import(pathToFileURL(resolve("dist/workflow/workflows.mjs")).href);
  world.registerHandler("__wkf_workflow_", (request) => flow.POST(request));
  await world.start?.();
  const metadata = JSON.parse(
    await readFile(resolve("dist/workflow/assistant-entry.json"), "utf8"),
  );
  const run = await withAssistantTrace(workflowInput, "core-assistant.enqueue", () =>
    start(metadata, [workflowInput], {
      world: { ...world, createRunId: () => workflowRunId.slice(5) },
    }),
  );
  assert.equal(run.runId, workflowRunId);
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const embeddedCreatedAt = [...workflowRunId.slice(5, 15)].reduce(
    (value, digit) => value * 32 + alphabet.indexOf(digit),
    0,
  );
  assert.equal(embeddedCreatedAt, Date.parse(workflowInput.createdAt));
  assert.equal(assistantWorkflowRunId({ ...workflowInput }), workflowRunId);
  const finished = Promise.race([
    run.returnValue,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Smoke run timed out")), 20000);
    }),
  ]);
  if (scenario === "reject-facts") {
    await assert.rejects(finished, /Assistant generation failed/);
    assert.equal(failed, "OUTCOME_VALIDATION_FAILED");
    assert.equal(completed, undefined);
    assert.equal(calls, 8);
    assert.equal(toolCalls, 0);
    assert.equal(validations.length, 8);
    assert.ok(validations.every((result) => !result.accepted));
    assert.deepEqual(checkpoints, []);
    console.log(
      "Assistant WorkflowAgent smoke passed (unsupported facts rejected, no display, bounded eight-step repair)",
    );
  } else {
    await finished;
    assert.equal(failed, undefined);
    assert.equal(completed, responseText);
    assert.ok(checkpoints.includes(completed));
    assert.ok(
      checkpoints.includes(scenario === "grounded" ? "Here is your" : responseText.slice(0, 4)),
    );
    assert.ok(!checkpoints.includes(rejectedText));
    assert.ok(!checkpoints.includes("Unstructured preface"));
    assert.equal(calls, 2);
    assert.ok(activities.includes("writing"));
    assert.equal(toolCalls, scenario === "grounded" ? 1 : 0);
    if (scenario === "repair-greeting") {
      assert.equal(repairFeedbackSeen, true);
      assert.equal(validations.length, 2);
      assert.equal(validations[0].accepted, false);
      assert.equal(validations[1].accepted, true);
    }
    const spans = exporter
      .getFinishedSpans()
      .filter((span) => span.name.startsWith("core-assistant."));
    assert.ok(spans.some((span) => span.name === "core-assistant.validate-outcome"));
    if (scenario === "grounded")
      assert.ok(spans.some((span) => span.name === "core-assistant.tool.get_profile"));
    assert.ok(spans.some((span) => span.name === "core-assistant.model"));
    assert.equal(new Set(spans.map((span) => span.spanContext().traceId)).size, 1);
    const workflowSpans = exporter
      .getFinishedSpans()
      .filter((span) => /^(workflow\.|step\.)/.test(span.name));
    assert.ok(workflowSpans.length > 0);
    assert.equal(
      new Set([...spans, ...workflowSpans].map((span) => span.spanContext().traceId)).size,
      1,
    );
    for (const span of spans) {
      assert.equal(span.attributes["user.id"], "fixture-user");
      assert.equal(span.attributes["session.id"], "fixture-thread");
    }
    assert.equal(await run.status, "completed");
    assert.equal(await getRun(run.runId).exists, true);
    await getRun(run.runId).returnValue;
    assert.equal(calls, 2);
    console.log(
      scenario === "repair-greeting"
        ? "Assistant WorkflowAgent smoke passed (greeting repaired from answer to conversation, feedback received, rejected text hidden, zero native reads)"
        : "Assistant WorkflowAgent smoke passed (timestamp-correct deterministic run ID, native catalog serialization, durable model/tool steps, partial JSON checkpoints, shared trace and completion)",
    );
  }
} finally {
  clearTimeout(timer);
  // Completion is durable before the delivering handler has finished its last write.
  while (deliveries.size) await Promise.allSettled([...deliveries]);
  await world.close?.();
  await provider.shutdown();
  registerAssistantExecution(undefined);
  await rm(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
