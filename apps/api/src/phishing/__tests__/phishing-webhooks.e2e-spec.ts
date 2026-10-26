import { randomUUID } from "node:crypto";

import {
  COURSE_ENROLLMENT,
  COURSE_STATUSES,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@repo/shared";
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { match, P } from "ts-pattern";

import { EnvService } from "src/env/services/env.service";
import { PHISHING_RISKY_ACTIONS } from "src/phishing/constants/phishing.constants";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { studentCourses } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSecretFactory } from "../../../test/factory/secret.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import {
  signPhishingWebhook,
  startFakePhishingPlugin,
  storeFakePhishingPluginSettings,
} from "../../../test/helpers/phishing-plugin";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  CAMPAIGN_RECIPIENT_STATES,
  EMAIL_SCENARIO_ID,
  REJECTED_EMAIL_CASES,
  REJECTED_RISKY_ACTION_CASES,
  SIGNED_REQUEST_KINDS,
  STALE_SIGNATURE_AGE_SECONDS,
  TRUSTED_TRACKING_URL,
} from "./phishing-webhooks.scenarios";

import type { CampaignRecipientState, SignedRequestKind } from "./phishing-webhooks.scenarios";
import type { CourseTest } from "../../../test/factory/course.factory";
import type { FakePhishingPlugin } from "../../../test/helpers/phishing-plugin";
import type { RiskyActionEvent } from "@mentingo/phishing-simulation-sdk";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

const PHISHING_TABLES = ["secrets", "settings", "users", "courses", "categories"] as const;

describe("Phishing plugin webhooks (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let defaultTenantId: string;
  let plugin: FakePhishingPlugin;
  let inTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let secretFactory: ReturnType<typeof createSecretFactory>;

  const arrangeUser = (roleSlug: SystemRoleSlug) =>
    inTenant(async () => {
      const user = await userFactory.create({ roleSlug, firstName: "Recipient" });
      await createSettingsFactory(db, user.id, roleSlug === SYSTEM_ROLE_SLUGS.ADMIN).create();

      return user;
    });

  const arrangeCourse = (status: CourseTest["status"] = COURSE_STATUSES.PUBLISHED) =>
    inTenant(() => courseFactory.create({ status, priceInCents: 0, title: "Phishing awareness" }));

  /** A learner, the admin who launched the campaign, its course, and the plugin's campaign record. */
  const arrangeCampaign = async ({
    recipient = CAMPAIGN_RECIPIENT_STATES.CLICKED,
    courseStatus = COURSE_STATUSES.PUBLISHED,
    scenarioId = EMAIL_SCENARIO_ID,
  }: {
    recipient?: CampaignRecipientState;
    courseStatus?: CourseTest["status"];
    scenarioId?: string;
  } = {}) => {
    const admin = await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const learner = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
    const course = await arrangeCourse(courseStatus);
    const recipients = match(recipient)
      .with(CAMPAIGN_RECIPIENT_STATES.CLICKED, () => [
        {
          userId: learner.id,
          sentAt: new Date().toISOString(),
          clickedAt: new Date().toISOString(),
        },
      ])
      .with(CAMPAIGN_RECIPIENT_STATES.ABSENT, () => [])
      .exhaustive();
    const campaign = plugin.seedCampaign(
      { courseId: course.id, createdBy: admin.id, scenarioId },
      recipients,
    );

    return { admin, learner, course, campaign };
  };

  const sendSigned = (path: string, payload: object, signedRequest: SignedRequestKind) => {
    const rawBody = JSON.stringify(
      match(signedRequest)
        .with(SIGNED_REQUEST_KINDS.UNEXPECTED_FIELD, () => ({ ...payload, extra: true }))
        .otherwise(() => payload),
    );
    const headers = match(signedRequest)
      .with(P.union(SIGNED_REQUEST_KINDS.VALID, SIGNED_REQUEST_KINDS.UNEXPECTED_FIELD), () =>
        signPhishingWebhook(rawBody),
      )
      .with(SIGNED_REQUEST_KINDS.WRONG_SECRET, () =>
        signPhishingWebhook(rawBody, { secret: "another-webhook-secret-of-32+chars" }),
      )
      .with(SIGNED_REQUEST_KINDS.STALE_TIMESTAMP, () =>
        signPhishingWebhook(rawBody, {
          timestamp: Math.floor(Date.now() / 1000) - STALE_SIGNATURE_AGE_SECONDS,
        }),
      )
      .with(SIGNED_REQUEST_KINDS.BODY_CHANGED_AFTER_SIGNING, () =>
        signPhishingWebhook(JSON.stringify({ ...payload, changed: true })),
      )
      .exhaustive();

    return request(app.getHttpServer()).post(path).set(headers).send(rawBody);
  };

  const riskyActionEvent = (
    campaign: { id: string },
    learner: { id: string },
    action: RiskyActionEvent["action"] = PHISHING_RISKY_ACTIONS.CLICKED,
  ): RiskyActionEvent => ({
    id: randomUUID(),
    tenantId: defaultTenantId,
    userId: learner.id,
    campaignId: campaign.id,
    action,
  });

  const findEnrollments = (learnerId: string, courseId: string) =>
    baseDb
      .select({ status: studentCourses.status })
      .from(studentCourses)
      .where(and(eq(studentCourses.studentId, learnerId), eq(studentCourses.courseId, courseId)));

  beforeAll(async () => {
    const context = await createE2ETest({ useDbProxy: true });
    app = context.app;
    defaultTenantId = context.defaultTenantId;
    inTenant = (fn) => context.runAsTenant(defaultTenantId, fn);
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
    secretFactory = createSecretFactory(app.get(EnvService));
    plugin = await startFakePhishingPlugin();
  });

  beforeEach(async () => {
    await truncateTables(baseDb, [...PHISHING_TABLES]);
    plugin.reset();
    await inTenant(() => createSettingsFactory(db).create({ userId: null }));
    await inTenant(() => storeFakePhishingPluginSettings(secretFactory, plugin));
  });

  afterEach(async () => {
    await truncateTables(baseDb, [...PHISHING_TABLES]);
  });

  afterAll(async () => {
    await plugin.close();
    await app.close();
  });

  describe("risky action", () => {
    it("enrolls the recipient in the campaign course once across webhook retries", async () => {
      const { learner, course, campaign } = await arrangeCampaign();
      const event = riskyActionEvent(campaign, learner);

      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await sendSigned(
          "/api/phishing/webhook",
          event,
          SIGNED_REQUEST_KINDS.VALID,
        );
        expect(response.status).toBe(201);
        expect(response.body).toEqual({ data: { accepted: true } });
      }

      expect(await findEnrollments(learner.id, course.id)).toEqual([
        { status: COURSE_ENROLLMENT.ENROLLED },
      ]);
      expect(plugin.requestsTo(`/campaigns/${campaign.id}/report`)).toEqual([
        expect.objectContaining({ tenantId: defaultTenantId }),
        expect.objectContaining({ tenantId: defaultTenantId }),
      ]);
    });

    it.each(REJECTED_RISKY_ACTION_CASES)(
      "rejects $title without enrolling anyone",
      async ({ signedRequest, recipient, action, pluginContacted }) => {
        const { learner, course, campaign } = await arrangeCampaign({ recipient });

        const response = await sendSigned(
          "/api/phishing/webhook",
          riskyActionEvent(campaign, learner, action),
          signedRequest,
        );

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("phishing.unavailable");
        expect(await findEnrollments(learner.id, course.id)).toEqual([]);
        expect(plugin.requests.length > 0).toBe(pluginContacted);
      },
    );
  });

  describe("connection probe", () => {
    it("echoes the nonce of a correctly signed probe without contacting the plugin", async () => {
      const nonce = "a".repeat(32);

      const response = await sendSigned(
        "/api/phishing/webhook/probe",
        { tenantId: defaultTenantId, nonce },
        SIGNED_REQUEST_KINDS.VALID,
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ data: { nonce } });
      expect(plugin.requests).toEqual([]);
    });
  });

  describe("campaign email", () => {
    it("renders the scenario's built-in email with the tracking link and the course address", async () => {
      const { learner, course, campaign } = await arrangeCampaign();

      const response = await sendSigned(
        "/api/phishing/webhook/email",
        {
          tenantId: defaultTenantId,
          campaignId: campaign.id,
          userId: learner.id,
          trackingUrl: TRUSTED_TRACKING_URL,
        },
        SIGNED_REQUEST_KINDS.VALID,
      );

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        subject: expect.any(String),
        html: expect.stringContaining(TRUSTED_TRACKING_URL),
        text: expect.stringContaining(TRUSTED_TRACKING_URL),
        courseUrl: expect.stringMatching(new RegExp(`/course/${course.id}$`)),
        attachments: expect.any(Array),
      });
      expect(response.body.data.subject).not.toBe("");
    });

    it.each(REJECTED_EMAIL_CASES)(
      "refuses $title with $expectedStatus",
      async ({
        signedRequest,
        trackingUrl,
        recipient,
        scenarioId,
        courseStatus,
        expectedStatus,
        expectedMessage,
      }) => {
        const { learner, campaign } = await arrangeCampaign({
          recipient,
          scenarioId,
          courseStatus,
        });

        const response = await sendSigned(
          "/api/phishing/webhook/email",
          { tenantId: defaultTenantId, campaignId: campaign.id, userId: learner.id, trackingUrl },
          signedRequest,
        );

        expect(response.status).toBe(expectedStatus);
        expect(response.body.message).toBe(expectedMessage);
      },
    );
  });
});
