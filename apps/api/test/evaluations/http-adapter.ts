import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import { AI_THREAD_STATUSES, MESSAGE_ROLE, SUPPORTED_LANGUAGES } from "@repo/shared";

import { completeCase as completeBaseCase, scoreSearch as scoreBaseSearch } from "./evaluation";

import type {
  CaseResult,
  HttpRunConfig,
  RegressionCase,
  NativeHttpExchange,
} from "./evaluation.types";

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
  const exchanges: NativeHttpExchange[] = [];
  let authenticatedActor: { id: string; roleSlugs: unknown; permissions: unknown } | undefined;
  const attachNativeEvidence = (result: CaseResult): CaseResult => ({
    ...result,
    evidence: {
      ...result.evidence,
      nativeTransport: {
        kind: "authenticated_http_requests_and_authorized_native_readbacks",
        baseUrl: base,
        authentication: { cookieEnv: fixture.cookieEnv, actor: authenticatedActor },
        exchanges,
        providerInternalsCaptured: false,
      },
    },
  });
  const completeCase = (...args: Parameters<typeof completeBaseCase>) =>
    attachNativeEvidence(completeBaseCase(...args));
  const scoreSearch = (...args: Parameters<typeof scoreBaseSearch>) =>
    attachNativeEvidence(scoreBaseSearch(...args));

  const request = async (
    path: string,
    body?: JsonObject,
    requestCookie = cookie,
  ): Promise<JsonObject> => {
    const response = await fetch(`${base}${path}`, {
      method: body ? "POST" : "GET",
      redirect: "error",
      headers: { Cookie: requestCookie, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw Object.assign(new Error(`Application returned HTTP ${response.status}`), {
        status: response.status,
      });
    const json = (await response.json()) as JsonObject;
    if (!json || typeof json.data !== "object" || json.data === null)
      throw new Error("Application response lacks data");
    exchanges.push({
      method: body ? "POST" : "GET",
      path,
      httpStatus: response.status,
      responseSha256: createHash("sha256").update(JSON.stringify(json.data)).digest("hex"),
      response: json.data,
    });
    return json.data;
  };
  if (fixture.actorUserId) {
    const actor = await request("/auth/current-user");
    if (actor.id !== fixture.actorUserId)
      throw new Error("Authenticated native actor does not match the isolated fixture");
    authenticatedActor = {
      id: actor.id,
      roleSlugs: actor.roleSlugs,
      permissions: actor.permissions,
    };
  }

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

  if (item.execution === "assessment") {
    const configured = item.input.rubric as JsonObject;
    if (
      !fixture.threadId ||
      !fixture.lessonId ||
      !fixture.blockingErrorIds ||
      !Array.isArray(item.input.transcript) ||
      !Array.isArray(item.expected.blockerRefs) ||
      !Array.isArray(configured?.blockingErrors)
    )
      throw new Error("Assessment fixture lacks owned transcript/rubric/blocker mappings");
    const refs = configured.blockingErrors.map((blocker: JsonObject) => blocker.ref);
    const allMappedIds = refs.map((ref: string) => fixture.blockingErrorIds?.[ref]);
    if (
      allMappedIds.some((id: unknown) => typeof id !== "string" || !id) ||
      new Set(allMappedIds).size !== allMappedIds.length ||
      Object.keys(fixture.blockingErrorIds).length !== refs.length
    )
      throw new Error("Every configured blocker needs a unique persisted ID mapping");
    const threadPath = `/ai/thread?thread=${encodeURIComponent(fixture.threadId)}`;
    const beforeThread = await request(threadPath);
    if (
      beforeThread.id !== fixture.threadId ||
      beforeThread.status !== AI_THREAD_STATUSES.ACTIVE ||
      beforeThread.userLanguage !== item.input.language
    )
      throw new Error("Assessment requires the expected active owned thread and language");
    const rubricCookie = fixture.rubricCookieEnv ? process.env[fixture.rubricCookieEnv] : cookie;
    if (!rubricCookie) throw new Error("Missing authorized rubric read credential");
    const rubric = await request(
      `/lesson/${encodeURIComponent(
        fixture.lessonId,
      )}/ai-judge-configuration?language=${encodeURIComponent(String(item.input.language))}`,
      undefined,
      rubricCookie,
    );
    const expectedBlockers = configured.blockingErrors.map((blocker: JsonObject) => ({
      id: fixture.blockingErrorIds?.[blocker.ref],
      description: blocker.description,
    }));
    if (
      rubric.aiMentorLessonId !== beforeThread.aiMentorLessonId ||
      rubric.language !== item.input.language ||
      rubric.taskGoal !== configured.taskGoal ||
      rubric.passingThresholdPercent !== configured.passingThresholdPercent ||
      !Array.isArray(rubric.criteria) ||
      rubric.criteria.length !== 0 ||
      JSON.stringify(rubric.blockingErrors) !== JSON.stringify(expectedBlockers)
    )
      throw new Error("Persisted assessment rubric does not match the versioned regression policy");
    const transcript = await request(
      `/ai/thread/messages?thread=${encodeURIComponent(fixture.threadId)}`,
    );
    if (!Array.isArray(transcript)) throw new Error("Assessment transcript readback is invalid");
    const actual = transcript
      .filter((message) => [MESSAGE_ROLE.USER, MESSAGE_ROLE.MENTOR].includes(message.role))
      .map(({ role, content }) => ({ role, content }));
    if (JSON.stringify(actual) !== JSON.stringify(item.input.transcript))
      throw new Error("Assessment fixture transcript does not match the regression case");
    const expectedIds = item.expected.blockerRefs.map(
      (ref) => fixture.blockingErrorIds?.[String(ref)],
    );
    if (expectedIds.some((id) => typeof id !== "string" || !id))
      throw new Error("Unknown expected blocker reference");
    // This endpoint runs Core's initial judge and independent blocking-error verification.
    const judged = await request(`/ai/judge/${encodeURIComponent(fixture.threadId)}`, {});
    const afterThread = await request(threadPath);
    const returnedIds = Array.isArray(judged.blockingErrors)
      ? judged.blockingErrors.map((blocker: JsonObject) => blocker.blockingErrorId)
      : null;
    return completeCase(
      item,
      {
        expectedPass: judged.passed === item.expected.passed,
        exactVerifiedBlockers:
          returnedIds !== null &&
          JSON.stringify([...returnedIds].sort()) === JSON.stringify([...expectedIds].sort()),
        emptyScoredRubric:
          Array.isArray(judged.criteria) &&
          judged.criteria.length === 0 &&
          judged.score === 0 &&
          judged.maxScore === 0,
        nativeThreadCompleted:
          afterThread.id === fixture.threadId &&
          afterThread.status === AI_THREAD_STATUSES.COMPLETED,
      },
      {
        transcript: actual,
        judgement: judged,
        rubric,
        threadId: afterThread.id,
        nativeThreadStatus: afterThread.status,
      },
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
      if (!response.ok)
        throw Object.assign(new Error(`Mentor returned HTTP ${response.status}`), {
          status: response.status,
        });
      // Consume the full stream before reading persisted messages; never treat first-token delivery as completion.
      const stream = await response.text();
      exchanges.push({
        method: "POST",
        path: "/ai/chat",
        httpStatus: response.status,
        responseSha256: createHash("sha256").update(stream).digest("hex"),
        response: { streamConsumed: true, responseBytes: Buffer.byteLength(stream) },
      });
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
    // Opening a native session intentionally normalizes legacy block identities.
    // Capture the editing baseline after that documented setup step.
    const session = fixture.authoringResumeSessionId
      ? await request(`${path}/sessions/${encodeURIComponent(fixture.authoringResumeSessionId)}`)
      : await request(`${path}/sessions`, { commandId: randomUUID(), language });
    if (
      fixture.authoringResumeSessionId &&
      (session.courseId !== fixture.courseId || session.language !== language)
    )
      throw new Error("Saved authoring session does not match its owned course and language");
    const before = await request(`${path}/context?language=${language}`);
    const sessionPath = `${path}/sessions/${encodeURIComponent(session.sessionId)}`;
    const sourceVersionIds: string[] = [];
    let sourceIngestion: JsonObject | undefined;
    if (fixture.authoringSourceText !== undefined && !fixture.authoringResumeSessionId) {
      if (!fixture.authoringSourceText.trim() || fixture.authoringSourceText.length > 50000)
        throw new Error("Authoring source fixture must be bounded, explicit synthetic text");
      const form = new FormData();
      form.set("commandId", randomUUID());
      form.set(
        "file",
        new Blob([fixture.authoringSourceText], { type: "text/plain" }),
        "synthetic-course-context.txt",
      );
      const uploaded = await fetch(`${base}${sessionPath}/sources`, {
        method: "POST",
        redirect: "error",
        headers: { Cookie: cookie },
        body: form,
        signal: AbortSignal.timeout(60000),
      });
      if (!uploaded.ok)
        throw new Error(`Native authoring source upload returned HTTP ${uploaded.status}`);
      const uploadBody = (await uploaded.json()) as JsonObject;
      if (
        typeof uploadBody.data?.sourceVersionId !== "string" ||
        typeof uploadBody.data?.taskId !== "string"
      )
        throw new Error("Native authoring source upload lacks source/task identities");
      const deadline = Date.now() + 120000;
      let ready = false;
      while (Date.now() < deadline) {
        const snapshot = await request(sessionPath);
        const task = snapshot.tasks?.find(
          (candidate: JsonObject) => candidate.taskId === uploadBody.data.taskId,
        );
        if (task?.status === "succeeded") {
          ready = true;
          break;
        }
        if (["failed", "cancelled"].includes(task?.status))
          throw new Error("Native authoring source ingestion failed");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (!ready) throw new Error("Native authoring source ingestion timed out");
      sourceVersionIds.push(uploadBody.data.sourceVersionId);
      sourceIngestion = {
        ...uploadBody.data,
        ready: true,
        inputSha256: createHash("sha256").update(fixture.authoringSourceText).digest("hex"),
      };
    }

    let clarification: JsonObject | undefined;
    if (fixture.authoringResumeSessionId) {
      const questions = session.records?.filter((record: JsonObject) => record.kind === "question");
      if (
        questions?.length !== 1 ||
        typeof questions[0].payload?.taskId !== "string" ||
        !Number.isInteger(questions[0].payload?.revision) ||
        !session.tasks?.some(
          (task: JsonObject) =>
            task.taskId === questions[0].payload.taskId && task.status === "waiting_author",
        )
      )
        throw new Error("Saved session must contain exactly one waiting native clarification");
      const question = questions[0].payload;
      const savedRequest = session.records?.find(
        (record: JsonObject) =>
          record.kind === "request" && record.payload?.requestId === question.requestId,
      )?.payload;
      if (
        savedRequest?.instruction !== item.input.instruction ||
        savedRequest.targets?.length !== 1 ||
        savedRequest.targets[0].targetId !== fixture.courseId ||
        savedRequest.targets[0].language !== language ||
        !Array.isArray(savedRequest.targets[0].allowedFields) ||
        savedRequest.targets[0].allowedFields.length !== 1 ||
        savedRequest.targets[0].allowedFields[0] !== "title"
      )
        throw new Error("Saved clarification request does not match the unchanged title-only task");
      const answer = JSON.stringify({
        currentCourse: before.course,
        requestedInstruction: item.input.instruction,
        allowedFields: ["title"],
      });
      if (answer.length > 20000) throw new Error("Canonical clarification context exceeds bound");
      clarification = { question, answer, provenance: "fresh_authorized_native_course_context" };
      await request(`${sessionPath}/commands`, {
        schemaVersion: 1,
        commandId: randomUUID(),
        action: "question.answer",
        targetId: question.taskId,
        expectedRevision: question.revision,
        answer,
      });
    } else
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
            sourceVersionIds,
            webEnabled: false,
            generalKnowledgeEnabled: sourceVersionIds.length === 0,
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
    if (item.input.proposalOnly === true) {
      const unchanged = await request(`${path}/context?language=${language}`);
      return completeCase(
        item,
        {
          scopedProposal:
            typeof proposal.id === "string" &&
            Number.isInteger(proposal.revision) &&
            proposal.revision > 0,
          nativeCourseUnchanged: isDeepStrictEqual(before, unchanged),
        },
        {
          sourceIngestion,
          clarification,
          requestedInstruction: item.input.instruction,
          beforeTitle: before.course.title,
          proposedTitle: proposal.operations[0].payload.title,
          proposal,
          originalContext: before,
          persistedContext: unchanged,
          nativeApplyAttempted: false,
        },
      );
    }
    let concurrentContext: JsonObject | undefined;
    let concurrentTitle: string | undefined;
    if (item.input.staleBaseline === true) {
      concurrentTitle = `Concurrent synthetic edit ${randomUUID()}`;
      const edited = await fetch(`${base}/course/${encodeURIComponent(fixture.courseId)}`, {
        method: "PATCH",
        redirect: "error",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ title: concurrentTitle, language }),
        signal: AbortSignal.timeout(30000),
      });
      if (!edited.ok) throw new Error(`Native concurrent edit returned HTTP ${edited.status}`);
      concurrentContext = await request(`${path}/context?language=${language}`);
      if (
        concurrentContext.course?.title !== concurrentTitle ||
        concurrentContext.baselineHash === before.baselineHash
      )
        throw new Error("Concurrent native title edit was not persisted with a new baseline");
    }
    await request(`${sessionPath}/commands`, {
      schemaVersion: 1,
      commandId: randomUUID(),
      action: "proposal.accept",
      targetId: proposal.id,
      expectedRevision: proposal.revision,
    });
    if (item.input.staleBaseline === true) {
      const submitted = await fetch(`${base}${sessionPath}/applications`, {
        method: "POST",
        redirect: "error",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          commandId: randomUUID(),
          proposalIds: [proposal.id],
          omitOptionalAssetIds: [],
        }),
        signal: AbortSignal.timeout(30000),
      });
      const body = (await submitted.json()) as JsonObject;
      let terminal: JsonObject;
      if (submitted.status === 409) terminal = { status: "conflict", reason: body.message };
      else {
        if (!submitted.ok || typeof body.data?.exportId !== "string")
          throw new Error(
            `Stale proposal application returned unexpected HTTP ${submitted.status}`,
          );
        terminal = await poll(
          () => request(`${sessionPath}/applications/${encodeURIComponent(body.data.exportId)}`),
          (value) => ["conflict", "failed", "applied"].includes(value.status),
        );
      }
      const afterConflict = await request(`${path}/context?language=${language}`);
      return completeCase(
        item,
        {
          typedBaselineConflict:
            terminal.status === "conflict" &&
            terminal.reason === "courseAuthoring.errors.baselineChanged",
          noAppliedReceipt: terminal.receipt?.status !== "applied",
          concurrentEditPreserved:
            typeof concurrentTitle === "string" && afterConflict.course.title === concurrentTitle,
          nativeGraphPreserved:
            Boolean(concurrentContext) && isDeepStrictEqual(afterConflict, concurrentContext),
        },
        {
          courseId: fixture.courseId,
          sessionId: session.sessionId,
          sourceIngestion,
          clarification,
          requestedInstruction: item.input.instruction,
          proposal,
          originalContext: before,
          concurrentContext,
          persistedContext: afterConflict,
          submissionHttpStatus: submitted.status,
          terminal,
        },
      );
    }
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
        sourceIngestion,
        clarification,
        requestedInstruction: item.input.instruction,
        beforeTitle: oldTitle,
        afterTitle: newTitle,
        exportId: queued.exportId,
        receiptStatus: applied.receipt?.status,
        proposedTitle: proposal.operations[0].payload.title,
        receipt: applied.receipt,
        originalCourse: before.course,
        persistedCourse: after.course,
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
