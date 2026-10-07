import { randomUUID } from "node:crypto";

import { ReasoningEffort } from "@japro/luma-sdk";
import { SUPPORTED_LANGUAGES, SYSTEM_ROLE_PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { eq } from "drizzle-orm";
import httpRequest from "supertest";

import { CourseAuthoringApplicationService } from "src/luma/course-authoring-application.service";
import { LumaService } from "src/luma/luma.service";
import { authoringSessionSchema } from "src/luma/schema/course-authoring-session.schema";
import * as outboxConstants from "src/outbox/outbox.constants";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { DB, DB_APP } from "src/storage/db/db.providers";
import { createTenantAwareDb } from "src/storage/db/tenant-aware-session";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { courses } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CourseAuthoringContextService } from "src/luma/course-authoring-context.service";
import type { CourseAuthoringSessionService } from "src/luma/course-authoring-session.service";
import type { AuthoringCommandBody } from "src/luma/schema/course-authoring-session.schema";

const databaseUrl = process.env.AUTHORING_TEST_DATABASE_URL;
const aiBaseUrl = process.env.AUTHORING_AI_BASE_URL;
const aiApiKey = process.env.AUTHORING_AI_API_KEY;
const integration = databaseUrl && aiBaseUrl && aiApiKey ? describe : describe.skip;

const sourcePolicy = {
  sourceVersionIds: [],
  webEnabled: false,
  generalKnowledgeEnabled: true,
  researchDepth: "standard" as const,
  requiredSectionIds: [],
  excludedSectionIds: [],
};

integration("course authoring Core to AI HTTP roundtrip", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let runner: TenantDbRunnerService;
  let actor: CurrentUserType;
  let actorUser!: UserWithCredentials;
  let actorCookies = "";
  let courseId: string;
  let applicationService: CourseAuthoringApplicationService;
  const originalLumaBaseUrl = process.env.LUMA_BASE_URL;
  const originalLumaApiKey = process.env.LUMA_API_KEY;

  beforeAll(async () => {
    if (
      !databaseUrl ||
      !/^\/authoring_probe_[a-f0-9]+$/.test(new URL(databaseUrl).pathname) ||
      process.env.DATABASE_TEST_URL !== databaseUrl ||
      !aiBaseUrl ||
      !aiApiKey
    ) {
      throw new Error(
        "Explicit authoring_probe_<hex>, matching DATABASE_TEST_URL, and AI HTTP credentials are required",
      );
    }

    process.env.LUMA_BASE_URL = aiBaseUrl;
    process.env.LUMA_API_KEY = aiApiKey;

    const test = await createE2ETest([
      {
        provide: DB,
        useFactory: (base: DatabasePg, tenantRunner: TenantDbRunnerService) =>
          createTenantAwareDb(base, tenantRunner),
        inject: [DB_APP, TenantDbRunnerService],
      },
    ]);
    app = test.app;
    db = app.get(DB);
    runner = app.get(TenantDbRunnerService);
    applicationService = app.get(CourseAuthoringApplicationService);
    const publisher = app.get(OutboxPublisher);
    jest
      .spyOn(publisher, "publish")
      .mockImplementation((event, transaction) =>
        publisher.publishDurable(event, transaction ?? db),
      );
    jest.spyOn(outboxConstants, "isOutboxProcessingEnabled").mockReturnValue(true);

    await runner.runWithTenant(test.defaultTenantId, async () => {
      await createSettingsFactory(db).create();
      const user = await createUserFactory(db)
        .withCredentials({ password: "AuthoringContract123!" })
        .withAdminSettings(db)
        .create();
      actorUser = user;
      actor = {
        userId: user.id,
        tenantId: test.defaultTenantId,
        email: user.email,
        permissions: SYSTEM_ROLE_PERMISSIONS[SYSTEM_ROLE_SLUGS.ADMIN],
        roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
      };
      courseId = (
        await createCourseFactory(db).create({
          authorId: user.id,
          title: "HTTP roundtrip source title",
        })
      ).id;
    });

    const login = await httpRequest(app.getHttpServer()).post("/api/auth/login").send({
      email: actorUser.email,
      password: actorUser.credentials?.password,
    });
    expect(login.status).toBe(201);
    const rawCookies: unknown = login.headers["set-cookie"];
    if (Array.isArray(rawCookies)) {
      actorCookies = rawCookies
        .filter((cookie): cookie is string => typeof cookie === "string")
        .join("; ");
    } else if (typeof rawCookies === "string") {
      actorCookies = rawCookies;
    }
    expect(actorCookies.includes("access_token=")).toBe(true);
  }, 240000);

  afterAll(async () => {
    jest.restoreAllMocks();
    if (app) await app.close();
    if (originalLumaBaseUrl === undefined) delete process.env.LUMA_BASE_URL;
    else process.env.LUMA_BASE_URL = originalLumaBaseUrl;
    if (originalLumaApiKey === undefined) delete process.env.LUMA_API_KEY;
    else process.env.LUMA_API_KEY = originalLumaApiKey;
  }, 120000);

  it("runs create, request, proposal, accept, export, native apply, and receipt over HTTP", async () => {
    await runner.runWithTenant(actor.tenantId, async () => {
      const basePath = `/api/luma/authoring/courses/${courseId}`;
      const openResponse = await httpRequest(app.getHttpServer())
        .post(`${basePath}/sessions`)
        .set("Cookie", actorCookies)
        .send({ commandId: randomUUID(), language: SUPPORTED_LANGUAGES.EN })
        .expect(201);
      const opened = openResponse.body.data as { sessionId: string };
      const contextResponse = await httpRequest(app.getHttpServer())
        .get(`${basePath}/context`)
        .query({ language: SUPPORTED_LANGUAGES.EN })
        .set("Cookie", actorCookies)
        .expect(200);
      const context = contextResponse.body.data as Awaited<
        ReturnType<CourseAuthoringContextService["getContext"]>
      >;
      const request: AuthoringCommandBody = {
        schemaVersion: 1,
        commandId: randomUUID(),
        action: "request.create",
        request: {
          instruction: "Shorten the course title while preserving its meaning.",
          reasoningEffort: ReasoningEffort.Low,
          targets: [
            {
              targetId: courseId,
              kind: "course",
              language: SUPPORTED_LANGUAGES.EN,
              baselineHash: context.baselineHash,
              blockIds: [],
              allowedFields: ["title"],
            },
          ],
          sourcePolicy,
        },
      };

      const commandResponse = await httpRequest(app.getHttpServer())
        .post(`${basePath}/sessions/${opened.sessionId}/commands`)
        .set("Cookie", actorCookies)
        .send(request)
        .expect(201);
      const acceptedRequest = commandResponse.body.data as { taskIds?: string[] };
      const taskId = acceptedRequest.taskIds?.[0];
      if (!taskId) throw new Error("AI did not return an authoring task ID");

      const proposal = await waitForProposal(basePath, opened.sessionId, actorCookies, app);
      const operations = proposal.operations;
      expect(operations).toHaveLength(1);
      expect(operations[0]?.type).toBe("course.metadata.update");

      await httpRequest(app.getHttpServer())
        .post(`${basePath}/sessions/${opened.sessionId}/commands`)
        .set("Cookie", actorCookies)
        .send({
          schemaVersion: 1,
          commandId: randomUUID(),
          action: "proposal.accept",
          targetId: proposal.id,
          expectedRevision: proposal.revision,
        })
        .expect(201);

      const applicationQueue = app.get(QueueService).getQueue(QUEUE_NAMES.COURSE_AUTHORING_APPLY);
      await applicationQueue.pause();
      let exportId: string | undefined;
      try {
        const queuedResponse = await httpRequest(app.getHttpServer())
          .post(`${basePath}/sessions/${opened.sessionId}/applications`)
          .set("Cookie", actorCookies)
          .send({
            commandId: randomUUID(),
            proposalIds: [proposal.id],
            omitOptionalAssetIds: [],
          })
          .expect(201);
        const queued = queuedResponse.body.data as { exportId: string; status: string };
        exportId = queued.exportId;
        expect(queued.status).toBe("queued");
        const queuedExportId = queued.exportId;

        const receipt = await applicationService.process({
          courseId,
          sessionId: opened.sessionId,
          exportId: queuedExportId,
          actor,
        });
        expect(receipt.status).toBe("applied");
        expect(receipt.exportId).toBe(queuedExportId);

        const [course] = await db
          .select({ title: courses.title })
          .from(courses)
          .where(eq(courses.id, courseId));
        expect(course?.title?.en).toBe(operations[0]?.payload.title);

        const snapshotResponse = await httpRequest(app.getHttpServer())
          .get(`${basePath}/sessions/${opened.sessionId}`)
          .set("Cookie", actorCookies)
          .expect(200);
        const snapshot = snapshotResponse.body.data as Awaited<
          ReturnType<CourseAuthoringSessionService["get"]>
        >;
        expect(snapshot.records.some((record) => record.kind === "application")).toBe(true);
        expect(
          snapshot.turns?.some((turn) =>
            turn.parts.some(
              (part) => part.partKind === "proposal" && part.artifact?.artifactKind === "proposal",
            ),
          ),
        ).toBe(true);
        const statusResponse = await httpRequest(app.getHttpServer())
          .get(`${basePath}/sessions/${opened.sessionId}/applications/${queuedExportId}`)
          .set("Cookie", actorCookies)
          .expect(200);
        expect(statusResponse.body.data.status).toBe("applied");
      } finally {
        if (exportId) {
          const job = await applicationQueue.getJob(`${actor.tenantId}-${exportId}`);
          await job?.remove();
        }
        await applicationQueue.resume();
      }
    });
  }, 180000);
});

async function waitForProposal(
  basePath: string,
  sessionId: string,
  cookies: string,
  app: INestApplication,
) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const response = await httpRequest(app.getHttpServer())
      .get(`${basePath}/sessions/${sessionId}`)
      .set("Cookie", cookies);
    if (response.status !== 200) {
      if (response.status === 502) {
        const client = await app.get(LumaService).getLumaClient();
        const producer = await client.authoring.getSession({ sessionId });
        const paths = [...Value.Errors(authoringSessionSchema, producer)].map(
          (issue) => issue.path,
        );
        throw new Error(`Session snapshot contract rejected paths: ${paths.join(", ")}`);
      }
      throw new Error(
        `Session snapshot failed with HTTP ${response.status}: ${JSON.stringify(response.body)}`,
      );
    }
    const snapshot = response.body.data as Awaited<
      ReturnType<CourseAuthoringSessionService["get"]>
    >;
    const record = snapshot.records.find((item) => item.kind === "proposal");
    if (record) {
      const payload = record.payload as {
        id: string;
        revision: number;
        operations: Array<{ type: string; payload: { title?: string | null } }>;
      };
      return { id: payload.id, revision: payload.revision, operations: payload.operations };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Timed out waiting for the deterministic AI proposal");
}
