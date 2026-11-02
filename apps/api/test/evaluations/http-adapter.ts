import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { MESSAGE_ROLE, SUPPORTED_LANGUAGES } from "@repo/shared";

import { completeCase, scoreSearch } from "./evaluation";

import type { CaseResult, HttpRunConfig, RegressionCase } from "./evaluation.types";

type JsonObject = Record<string, any>;

/** Loopback only. Configuration never loads .env or Langfuse credentials. */
export function validateHttpConfig(config: HttpRunConfig): void {
  const base = new URL(config.baseUrl);
  if (
    base.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) ||
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    config.disposableTenant !== true ||
    !config.fixtures
  )
    throw new Error("HTTP evaluations require a loopback HTTP URL and disposableTenant=true");
  const used = new Set<string>();
  for (const fixture of Object.values(config.fixtures)) {
    if (fixture.isolated !== true || !fixture.cookieEnv)
      throw new Error("Every case needs an isolated fixture");
    for (const id of [fixture.threadId, fixture.courseId].filter(Boolean)) {
      if (used.has(String(id)))
        throw new Error("Thread/course fixtures must not be reused between cases");
      used.add(String(id));
    }
  }
}

/** Real HTTP execution is explicitly invoked by run.ts, never by dataset validation or unit tests. */
export async function runHttpCase(
  item: RegressionCase,
  config: HttpRunConfig,
): Promise<CaseResult> {
  const fixture = config.fixtures[item.id];
  if (!fixture) throw new Error("Missing isolated fixture");
  const cookie = process.env[fixture.cookieEnv];
  if (!cookie) throw new Error("Missing fixture cookie environment variable");
  const base = config.baseUrl.replace(/\/$/, "");
  const request = async (path: string, body?: JsonObject): Promise<JsonObject> => {
    const response = await fetch(`${base}${path}`, {
      method: body ? "POST" : "GET",
      redirect: "error",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`Application returned HTTP ${response.status}`);
    const json = (await response.json()) as JsonObject;
    if (!json || typeof json.data !== "object" || json.data === null)
      throw new Error("Application response lacks data");
    return json.data;
  };

  if (item.execution === "search") {
    if (!Array.isArray(fixture.expectedResultIds) || !Array.isArray(fixture.forbiddenResultIds))
      throw new Error("Search fixtures need explicit expected and forbidden ID lists");
    const query = new URLSearchParams({
      searchQuery: String(item.input.query),
      language: String(item.input.language),
      mode: String(item.input.mode),
    });
    return scoreSearch(
      item,
      await request(`/global-search?${query}`),
      fixture.expectedResultIds,
      fixture.forbiddenResultIds,
    );
  }

  if (item.execution === "mentor") {
    if (!fixture.threadId || !Array.isArray(item.input.turns))
      throw new Error("Mentor case lacks thread/turns");
    const path = `/ai/thread/messages?thread=${encodeURIComponent(fixture.threadId)}`;
    const before = await request(path);
    if (
      !Array.isArray(before) ||
      before.some(
        (message) => message.role === MESSAGE_ROLE.USER || message.role === MESSAGE_ROLE.MENTOR,
      )
    )
      throw new Error("Mentor fixture thread is not fresh");
    for (const turn of item.input.turns) {
      const response = await fetch(`${base}/ai/chat`, {
        method: "POST",
        redirect: "error",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          threadId: fixture.threadId,
          message: {
            id: randomUUID(),
            role: MESSAGE_ROLE.USER,
            parts: [{ type: "text", text: turn }],
          },
        }),
      });
      if (!response.ok) throw new Error(`Mentor returned HTTP ${response.status}`);
      // Consume the full stream before reading persisted messages; never treat first-token delivery as completion.
      await response.text();
    }
    const messages = await request(path);
    if (!Array.isArray(messages)) throw new Error("Mentor message readback is invalid");
    const userMessages = messages.filter((message) => message.role === MESSAGE_ROLE.USER);
    const assistantMessages = messages.filter((message) => message.role === MESSAGE_ROLE.MENTOR);
    return completeCase(
      item,
      {
        userTurnsPersisted:
          userMessages.length === item.input.turns.length &&
          userMessages.every(
            (message, index) => message.content === (item.input.turns as unknown[])[index],
          ),
        assistantTurnsPersisted: assistantMessages.length === item.input.turns.length,
        nonemptyReplies: assistantMessages.every(
          (message) => typeof message.content === "string" && message.content.trim().length > 0,
        ),
      },
      {
        threadId: fixture.threadId,
        messages: messages.map(({ role, content }) => ({ role, content })),
      },
    );
  }

  if (item.execution === "authoring") {
    if (!fixture.courseId || config.allowAuthoringWrites !== true)
      throw new Error("Authoring requires its own disposable course and allowAuthoringWrites=true");
    const language = item.input.language;
    if (!Object.values(SUPPORTED_LANGUAGES).includes(language as typeof SUPPORTED_LANGUAGES.EN))
      throw new Error("Unsupported authoring language");
    const path = `/luma/authoring/courses/${encodeURIComponent(fixture.courseId)}`;
    const before = await request(`${path}/context?language=${language}`);
    const session = await request(`${path}/sessions`, { commandId: randomUUID(), language });
    const sessionPath = `${path}/sessions/${encodeURIComponent(session.sessionId)}`;
    await request(`${sessionPath}/commands`, {
      schemaVersion: 1,
      commandId: randomUUID(),
      action: "request.create",
      request: {
        instruction: item.input.instruction,
        targets: [
          {
            targetId: fixture.courseId,
            kind: "course",
            language,
            baselineHash: before.baselineHash,
            blockIds: [],
            allowedFields: ["title"],
          },
        ],
        sourcePolicy: {
          sourceVersionIds: [],
          webEnabled: false,
          generalKnowledgeEnabled: true,
          researchDepth: "standard",
          requiredSectionIds: [],
          excludedSectionIds: [],
        },
      },
    });
    const poll = async (read: () => Promise<JsonObject>, ready: (value: JsonObject) => boolean) => {
      const deadline = Date.now() + 120000;
      while (Date.now() < deadline) {
        const value = await read();
        if (ready(value)) return value;
        if (["failed", "conflict", "stopped"].includes(value.status))
          throw new Error("Application flow reached a failed terminal state");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error("Application flow timed out");
    };
    const snapshot = await poll(
      () => request(sessionPath),
      (value) => value.records?.some((record: JsonObject) => record.kind === "proposal"),
    );
    const proposal = snapshot.records.find(
      (record: JsonObject) => record.kind === "proposal",
    ).payload;
    if (
      proposal.operations?.length !== 1 ||
      proposal.operations[0].type !== "course.metadata.update" ||
      proposal.operations[0].targetId !== fixture.courseId ||
      proposal.operations[0].language !== language ||
      typeof proposal.operations[0].operationId !== "string" ||
      !proposal.operations[0].operationId ||
      typeof proposal.operations[0].payload.title !== "string" ||
      Object.keys(proposal.operations[0].payload).some((key) => key !== "title")
    )
      throw new Error("Proposal exceeded the title-only target");
    await request(`${sessionPath}/commands`, {
      schemaVersion: 1,
      commandId: randomUUID(),
      action: "proposal.accept",
      targetId: proposal.id,
      expectedRevision: proposal.revision,
    });
    const queued = await request(`${sessionPath}/applications`, {
      commandId: randomUUID(),
      proposalIds: [proposal.id],
      omitOptionalAssetIds: [],
    });
    const applied = await poll(
      () => request(`${sessionPath}/applications/${encodeURIComponent(queued.exportId)}`),
      (value) => value.status === "applied",
    );
    const after = await request(`${path}/context?language=${language}`);
    const { title: oldTitle, ...oldCourse } = before.course;
    const { title: newTitle, ...newCourse } = after.course;
    return completeCase(
      item,
      {
        appliedReceipt: applied.receipt?.status === "applied",
        exportIdentity: applied.receipt?.exportId === queued.exportId,
        courseIdentity: applied.receipt?.courseId === fixture.courseId,
        sessionIdentity: applied.receipt?.sessionId === session.sessionId,
        exportHashPresent: /^[a-f0-9]{64}$/.test(applied.receipt?.exportHash ?? ""),
        operationIdentity: isDeepStrictEqual(
          applied.receipt?.appliedOperationIds,
          proposal.operations.map((operation: JsonObject) => operation.operationId),
        ),
        persistedTitle: newTitle === proposal.operations[0].payload.title && newTitle !== oldTitle,
        scopePreserved:
          isDeepStrictEqual(oldCourse, newCourse) &&
          isDeepStrictEqual(before.chapters, after.chapters),
      },
      {
        courseId: fixture.courseId,
        beforeTitle: oldTitle,
        afterTitle: newTitle,
        exportId: queued.exportId,
        receiptStatus: applied.receipt?.status,
      },
    );
  }
  return {
    caseId: item.id,
    status: "not_run",
    checks: {},
    evidence: {},
    reason: "Prepared case has no application adapter yet",
  };
}
