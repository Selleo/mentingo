import { randomUUID } from "node:crypto";

import {
  COURSE_ENROLLMENT,
  COURSE_PROGRESS_STATUSES,
  COURSE_STATUSES,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  SYSTEM_RULE_SET_SLUGS,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@repo/shared";
import { and, eq, inArray } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { EnvService } from "src/env/services/env.service";
import {
  PHISHING_CAMPAIGN_STATUSES,
  PHISHING_OPTION_KINDS,
  PHISHING_OPTION_PAGE_SIZE,
} from "src/phishing/constants/phishing.constants";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { permissionRuleSetPermissions, permissionRuleSets } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createSecretFactory } from "../../../test/factory/secret.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createStudentCourseFactory } from "../../../test/factory/student-course.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import {
  FAKE_PHISHING_SCENARIOS,
  startFakePhishingPlugin,
  storeFakePhishingPluginSettings,
} from "../../../test/helpers/phishing-plugin";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import {
  CAMPAIGN_AUDIENCES,
  CAMPAIGN_COURSES,
  CONFIGURATION_CASES,
  HIDDEN_REPORT_CASES,
  HTTP_METHODS,
  OPTION_FIXTURE,
  OPTION_SEARCH_CASES,
  PASSWORD,
  PLUGIN_FAILURE_CASES,
  PLUGIN_FAILURES,
  REJECTED_CAMPAIGN_CASES,
  ROLE_ACCESS_CASES,
} from "./phishing-campaigns.scenarios";

import type { CampaignAudience, CampaignCourse } from "./phishing-campaigns.scenarios";
import type { CourseTest } from "../../../test/factory/course.factory";
import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { FakePhishingPlugin } from "../../../test/helpers/phishing-plugin";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

const PHISHING_TABLES = [
  "secrets",
  "settings",
  "users",
  "groups",
  "courses",
  "categories",
] as const;

describe("Phishing campaigns (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let defaultTenantId: string;
  let plugin: FakePhishingPlugin;
  let inTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let studentCourseFactory: ReturnType<typeof createStudentCourseFactory>;
  let secretFactory: ReturnType<typeof createSecretFactory>;

  const api = () => request(app.getHttpServer());

  const arrangeUser = (
    roleSlug: SystemRoleSlug,
    overrides: Partial<{
      firstName: string;
      lastName: string;
      archived: boolean;
      deletedAt: string;
    }> = {},
  ) =>
    inTenant(async () => {
      const user = await userFactory
        .withCredentials({ password: PASSWORD })
        .create({ roleSlug, ...overrides });
      await createSettingsFactory(db, user.id, roleSlug === SYSTEM_ROLE_SLUGS.ADMIN).create();

      return user;
    });

  const arrangeGroup = (name: string, memberIds: string[] = [], managerIds: string[] = []) =>
    inTenant(() => groupFactory.withMembers(memberIds).withManagers(managerIds).create({ name }));

  const arrangeCourse = (
    overrides: Partial<Pick<CourseTest, "title" | "status" | "priceInCents">> = {},
  ) =>
    inTenant(() =>
      courseFactory.create({ status: COURSE_STATUSES.PUBLISHED, priceInCents: 0, ...overrides }),
    );

  const loginAs = (user: UserWithCredentials) => cookieFor(user, app);

  const arrangeOrganization = async () => {
    const admin = await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
    const manager = await arrangeUser(SYSTEM_ROLE_SLUGS.GROUP_MANAGER);
    const managedLearner = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
    const outsideLearner = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
    const managedGroup = await arrangeGroup("Managed team", [managedLearner.id], [manager.id]);
    const outsideGroup = await arrangeGroup("Outside team", [outsideLearner.id]);
    const course = await arrangeCourse({ title: "Phishing awareness" });

    return { admin, manager, managedLearner, outsideLearner, managedGroup, outsideGroup, course };
  };

  /** The plugin's snapshot lists the managed learner in both groups, so scoping must hide one. */
  const arrangeCampaign = (organization: Awaited<ReturnType<typeof arrangeOrganization>>) =>
    plugin.seedCampaign({ courseId: organization.course.id, createdBy: organization.admin.id }, [
      {
        userId: organization.managedLearner.id,
        firstName: "Managed",
        lastName: "Learner",
        groupIds: [organization.managedGroup.id, organization.outsideGroup.id],
        sentAt: new Date().toISOString(),
        clickedAt: new Date().toISOString(),
      },
      {
        userId: organization.outsideLearner.id,
        firstName: "Outside",
        lastName: "Learner",
        groupIds: [organization.outsideGroup.id],
        sentAt: new Date().toISOString(),
      },
    ]);

  const removeCourseEnrollmentFromAdmins = () =>
    inTenant(async () => {
      const adminRuleSets = await db
        .select({ id: permissionRuleSets.id })
        .from(permissionRuleSets)
        .where(
          and(
            eq(permissionRuleSets.tenantId, defaultTenantId),
            eq(permissionRuleSets.slug, SYSTEM_RULE_SET_SLUGS[SYSTEM_ROLE_SLUGS.ADMIN]),
          ),
        );

      await db.delete(permissionRuleSetPermissions).where(
        and(
          inArray(
            permissionRuleSetPermissions.ruleSetId,
            adminRuleSets.map(({ id }) => id),
          ),
          eq(permissionRuleSetPermissions.permission, PERMISSIONS.COURSE_ENROLLMENT),
        ),
      );
    });

  const reportRequestsFor = (campaignId: string) =>
    plugin.requests.filter(({ path }) => path.startsWith(`/campaigns/${campaignId}/report`));

  beforeAll(async () => {
    const context = await createE2ETest({ useDbProxy: true });
    app = context.app;
    defaultTenantId = context.defaultTenantId;
    inTenant = (fn) => context.runAsTenant(defaultTenantId, fn);
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    groupFactory = createGroupFactory(db);
    courseFactory = createCourseFactory(db);
    studentCourseFactory = createStudentCourseFactory(db);
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

  describe("access", () => {
    it.each(ROLE_ACCESS_CASES)(
      "$role gets $expectedStatus from $method $path",
      async ({ role, method, path, expectedStatus }) => {
        const cookie = await loginAs(await arrangeUser(role));

        const response = await match(method)
          .with(HTTP_METHODS.GET, () => api().get(path))
          .with(HTTP_METHODS.POST, () => api().post(path).send({}))
          .exhaustive()
          .set("Cookie", cookie);

        expect(response.status).toBe(expectedStatus);
      },
    );
  });

  describe("plugin availability", () => {
    it.each(CONFIGURATION_CASES)(
      "reports simulations enabled as $simulationsEnabled",
      async ({ simulationsEnabled }) => {
        if (!simulationsEnabled) plugin.disableSimulations();
        const cookie = await loginAs(await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN));

        const response = await api()
          .get("/api/phishing/configuration")
          .set("Cookie", cookie)
          .expect(200);

        expect(response.body.data).toEqual({ enabled: simulationsEnabled });
      },
    );

    it.each(PLUGIN_FAILURE_CASES)(
      "answers $expectedStatus with $expectedMessage when $title",
      async ({ failure, pluginStatus, expectedStatus, expectedMessage }) => {
        await match(failure)
          .with(PLUGIN_FAILURES.MISSING_SETTINGS, () => truncateTables(baseDb, ["secrets"]))
          .with(PLUGIN_FAILURES.SIMULATIONS_DISABLED, async () => plugin.disableSimulations())
          .with(PLUGIN_FAILURES.PLUGIN_ERROR, async () => plugin.failRequestsWith(pluginStatus!))
          .exhaustive();
        const cookie = await loginAs(await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN));

        const response = await api().get("/api/phishing/scenarios").set("Cookie", cookie);

        expect(response.status).toBe(expectedStatus);
        expect(response.body.message).toBe(expectedMessage);
      },
    );

    it("lists the plugin's scenarios for the current tenant", async () => {
      const cookie = await loginAs(await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN));

      const response = await api().get("/api/phishing/scenarios").set("Cookie", cookie).expect(200);

      expect(response.body.data).toEqual(FAKE_PHISHING_SCENARIOS);
      expect(plugin.requestsTo("/scenarios")).toEqual([
        expect.objectContaining({ tenantId: defaultTenantId }),
      ]);
    });
  });

  describe("audience options", () => {
    const arrangeOptionFixture = async () => {
      for (const person of OPTION_FIXTURE.people)
        await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT, {
          firstName: person.firstName,
          lastName: person.lastName,
          archived: person.archived,
          ...(person.deleted ? { deletedAt: new Date().toISOString() } : {}),
        });
      for (const name of OPTION_FIXTURE.groups) await arrangeGroup(name);
      for (const course of OPTION_FIXTURE.courses) await arrangeCourse(course);
    };

    it.each(OPTION_SEARCH_CASES)(
      "searches $kind, skipping inactive people and courses learners cannot be enrolled in",
      async ({ kind, search, expectedLabelPrefixes }) => {
        await arrangeOptionFixture();
        const cookie = await loginAs(await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN));

        const response = await api()
          .get("/api/phishing/options/search")
          .query({ kind, language: SUPPORTED_LANGUAGES.EN, page: 1, search })
          .set("Cookie", cookie)
          .expect(200);

        expect(response.body.data).toEqual({
          items: expectedLabelPrefixes.map((prefix) =>
            expect.objectContaining({ label: expect.stringContaining(prefix) }),
          ),
          hasNextPage: false,
        });
      },
    );

    it("reports a next page when more options match than fit on one page", async () => {
      for (let index = 0; index <= PHISHING_OPTION_PAGE_SIZE; index++)
        await arrangeGroup(`Phishgroup ${String(index).padStart(2, "0")}`);
      const cookie = await loginAs(await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN));
      const searchPage = (page: number) =>
        api()
          .get("/api/phishing/options/search")
          .query({
            kind: PHISHING_OPTION_KINDS.GROUPS,
            language: SUPPORTED_LANGUAGES.EN,
            page,
            search: "phishgroup",
          })
          .set("Cookie", cookie)
          .expect(200);

      const [firstPage, secondPage] = [
        (await searchPage(1)).body.data,
        (await searchPage(2)).body.data,
      ];

      expect(firstPage).toMatchObject({ hasNextPage: true });
      expect(firstPage.items).toHaveLength(PHISHING_OPTION_PAGE_SIZE);
      expect(secondPage).toEqual({
        items: [expect.objectContaining({ label: `Phishgroup ${PHISHING_OPTION_PAGE_SIZE}` })],
        hasNextPage: false,
      });
    });

    it("lists only active members of each group", async () => {
      const activeMember = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const archivedMember = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT, { archived: true });
      const group = await arrangeGroup("Mixed team", [activeMember.id, archivedMember.id]);
      const cookie = await loginAs(await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN));

      const response = await api()
        .get("/api/phishing/options")
        .query({ language: SUPPORTED_LANGUAGES.EN })
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body.data.groups).toEqual([
        { id: group.id, label: "Mixed team", userIds: [activeMember.id] },
      ]);
    });

    it("counts each active person once across picked people and groups", async () => {
      const pickedMember = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const otherMember = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const archivedMember = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT, { archived: true });
      const group = await arrangeGroup("Counted team", [
        pickedMember.id,
        otherMember.id,
        archivedMember.id,
      ]);
      const cookie = await loginAs(await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN));

      const response = await api()
        .post("/api/phishing/audience/count")
        .send({ userIds: [pickedMember.id], groupIds: [group.id] })
        .set("Cookie", cookie)
        .expect(201);

      expect(response.body.data).toEqual({ count: 2 });
    });
  });

  describe("campaign creation", () => {
    const hoursFromNow = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();

    const arrangeCampaignCourse = (course: CampaignCourse) =>
      match(course)
        .with(CAMPAIGN_COURSES.FREE, () => arrangeCourse())
        .with(CAMPAIGN_COURSES.DRAFT, () => arrangeCourse({ status: COURSE_STATUSES.DRAFT }))
        .with(CAMPAIGN_COURSES.PAID, () => arrangeCourse({ priceInCents: 1000 }))
        .exhaustive();

    const arrangeCampaignAudience = (audience: CampaignAudience) =>
      match(audience)
        .with(CAMPAIGN_AUDIENCES.ACTIVE_LEARNER, async () => ({
          userIds: [(await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT)).id],
          groupIds: [],
        }))
        .with(CAMPAIGN_AUDIENCES.ARCHIVED_LEARNER, async () => ({
          userIds: [(await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT, { archived: true })).id],
          groupIds: [],
        }))
        .with(CAMPAIGN_AUDIENCES.GROUP_WITHOUT_ACTIVE_MEMBERS, async () => {
          const archived = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT, { archived: true });
          return {
            userIds: [],
            groupIds: [(await arrangeGroup("Archived team", [archived.id])).id],
          };
        })
        .exhaustive();

    it("sends the active audience with their groups to the plugin on behalf of the admin", async () => {
      const admin = await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const pickedLearner = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const groupMember = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const archivedMember = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT, { archived: true });
      const group = await arrangeGroup("Drill team", [groupMember.id, archivedMember.id]);
      const course = await arrangeCourse();
      const cookie = await loginAs(admin);

      const response = await api()
        .post("/api/phishing/campaigns")
        .send({
          requestId: randomUUID(),
          name: "  Quarterly drill  ",
          scenarioId: FAKE_PHISHING_SCENARIOS[0].id,
          courseId: course.id,
          userIds: [pickedLearner.id],
          groupIds: [group.id],
          sendWindow: { start: hoursFromNow(1), end: hoursFromNow(24) },
        })
        .set("Cookie", cookie)
        .expect(201);

      expect(response.body.data).toMatchObject({
        name: "Quarterly drill",
        status: PHISHING_CAMPAIGN_STATUSES.SCHEDULED,
      });
      const [created] = plugin.requestsTo("/campaigns").filter(({ method }) => method === "POST");
      expect(created.body).toMatchObject({
        name: "Quarterly drill",
        courseId: course.id,
        createdBy: admin.id,
      });
      expect(created.body).toHaveProperty(
        "recipients",
        expect.arrayContaining([
          expect.objectContaining({ userId: pickedLearner.id, groupIds: [] }),
          expect.objectContaining({ userId: groupMember.id, groupIds: [group.id] }),
        ]),
      );
      expect((created.body as { recipients: unknown[] }).recipients).toHaveLength(2);
    });

    it.each(REJECTED_CAMPAIGN_CASES)(
      "rejects $title with $expectedMessage before contacting the plugin",
      async ({ name, sendWindowHours, course, audience, expectedMessage }) => {
        const cookie = await loginAs(await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN));
        const campaignCourse = await arrangeCampaignCourse(course);
        const campaignAudience = await arrangeCampaignAudience(audience);

        const response = await api()
          .post("/api/phishing/campaigns")
          .send({
            requestId: randomUUID(),
            name,
            scenarioId: FAKE_PHISHING_SCENARIOS[0].id,
            courseId: campaignCourse.id,
            ...campaignAudience,
            sendWindow: {
              start: hoursFromNow(sendWindowHours.start),
              end: hoursFromNow(sendWindowHours.end),
            },
          })
          .set("Cookie", cookie)
          .expect(400);

        expect(response.body.message).toBe(expectedMessage);
        expect(plugin.requestsTo("/campaigns")).toEqual([]);
      },
    );

    it("refuses admins who may not enroll learners", async () => {
      const admin = await arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const learner = await arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await arrangeCourse();
      await removeCourseEnrollmentFromAdmins();
      const cookie = await loginAs(admin);

      const response = await api()
        .post("/api/phishing/campaigns")
        .send({
          requestId: randomUUID(),
          name: "Quarterly drill",
          scenarioId: FAKE_PHISHING_SCENARIOS[0].id,
          courseId: course.id,
          userIds: [learner.id],
          groupIds: [],
          sendWindow: { start: hoursFromNow(1), end: hoursFromNow(24) },
        })
        .set("Cookie", cookie)
        .expect(403);

      expect(response.body.message).toBe("auth.error.missingPermission");
      expect(plugin.requests).toEqual([]);
    });
  });

  describe("campaign list and cancellation", () => {
    it("shows managers only campaigns that reached their groups", async () => {
      const organization = await arrangeOrganization();
      const visibleCampaign = arrangeCampaign(organization);
      plugin.seedCampaign({ courseId: organization.course.id, createdBy: organization.admin.id }, [
        { userId: organization.outsideLearner.id, groupIds: [organization.outsideGroup.id] },
      ]);
      const cookie = await loginAs(organization.manager);

      const response = await api().get("/api/phishing/campaigns").set("Cookie", cookie).expect(200);

      expect(response.body.data).toEqual([expect.objectContaining({ id: visibleCampaign.id })]);
    });

    it("shows admins every campaign", async () => {
      const organization = await arrangeOrganization();
      arrangeCampaign(organization);
      plugin.seedCampaign({ courseId: organization.course.id, createdBy: organization.admin.id }, [
        { userId: organization.outsideLearner.id, groupIds: [organization.outsideGroup.id] },
      ]);
      const cookie = await loginAs(organization.admin);

      const response = await api().get("/api/phishing/campaigns").set("Cookie", cookie).expect(200);

      expect(response.body.data).toHaveLength(2);
    });

    it("cancels a campaign in the plugin", async () => {
      const organization = await arrangeOrganization();
      const campaign = arrangeCampaign(organization);
      const cookie = await loginAs(organization.admin);

      const response = await api()
        .post(`/api/phishing/campaigns/${campaign.id}/cancel`)
        .set("Cookie", cookie)
        .expect(201);

      expect(response.body.data).toMatchObject({
        id: campaign.id,
        status: PHISHING_CAMPAIGN_STATUSES.CANCELLED,
      });
    });
  });

  describe("campaign report", () => {
    it("gives admins the whole campaign with risk rates and named groups", async () => {
      const organization = await arrangeOrganization();
      const campaign = arrangeCampaign(organization);
      const cookie = await loginAs(organization.admin);

      const response = await api()
        .get(`/api/phishing/campaigns/${campaign.id}/report`)
        .query({ language: SUPPORTED_LANGUAGES.EN })
        .set("Cookie", cookie)
        .expect(200);

      expect(reportRequestsFor(campaign.id)).toEqual([
        expect.objectContaining({ path: `/campaigns/${campaign.id}/report/summary`, query: {} }),
      ]);
      expect(response.body.data).toMatchObject({
        campaign: { id: campaign.id },
        riskyAction: FAKE_PHISHING_SCENARIOS[0].action,
        totals: { recipients: 2, risky: 1, riskRate: 50 },
      });
      expect(response.body.data.groups).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: organization.managedGroup.id,
            name: "Managed team",
            totals: expect.objectContaining({ recipients: 1, riskRate: 100 }),
          }),
          expect.objectContaining({
            id: organization.outsideGroup.id,
            name: "Outside team",
            totals: expect.objectContaining({ recipients: 2, riskRate: 50 }),
          }),
        ]),
      );
    });

    it("limits a manager's report to their groups", async () => {
      const organization = await arrangeOrganization();
      const campaign = arrangeCampaign(organization);
      const cookie = await loginAs(organization.manager);

      const response = await api()
        .get(`/api/phishing/campaigns/${campaign.id}/report`)
        .query({ language: SUPPORTED_LANGUAGES.EN })
        .set("Cookie", cookie)
        .expect(200);

      expect(reportRequestsFor(campaign.id)).toEqual([
        expect.objectContaining({ query: { groupIds: [organization.managedGroup.id] } }),
      ]);
      expect(response.body.data).toMatchObject({
        totals: { recipients: 1, risky: 1, riskRate: 100 },
        groups: [{ id: organization.managedGroup.id, name: "Managed team" }],
      });
    });

    it.each(HIDDEN_REPORT_CASES)(
      "hides the campaign from a manager when $title",
      async ({ managerHasGroup, expectedReportRequests }) => {
        const organization = await arrangeOrganization();
        const manager = await arrangeUser(SYSTEM_ROLE_SLUGS.GROUP_MANAGER);
        if (managerHasGroup) await arrangeGroup("Unreached team", [], [manager.id]);
        const campaign = plugin.seedCampaign(
          { courseId: organization.course.id, createdBy: organization.admin.id },
          [{ userId: organization.outsideLearner.id, groupIds: [organization.outsideGroup.id] }],
        );
        const cookie = await loginAs(manager);

        const responses = await Promise.all([
          api()
            .get(`/api/phishing/campaigns/${campaign.id}/report`)
            .query({ language: SUPPORTED_LANGUAGES.EN })
            .set("Cookie", cookie),
          api()
            .get(`/api/phishing/campaigns/${campaign.id}/report/recipients`)
            .set("Cookie", cookie),
        ]);

        expect(responses.map(({ status, body }) => [status, body.message])).toEqual([
          [404, "phishing.notFound"],
          [404, "phishing.notFound"],
        ]);
        expect(reportRequestsFor(campaign.id)).toHaveLength(expectedReportRequests);
      },
    );
  });

  describe("report recipients", () => {
    it("forwards the manager's query within their scope and adds course progress", async () => {
      const organization = await arrangeOrganization();
      const campaign = arrangeCampaign(organization);
      await inTenant(() =>
        studentCourseFactory.create({
          studentId: organization.managedLearner.id,
          courseId: organization.course.id,
          progress: COURSE_PROGRESS_STATUSES.IN_PROGRESS,
        }),
      );
      const cookie = await loginAs(organization.manager);

      const response = await api()
        .get(`/api/phishing/campaigns/${campaign.id}/report/recipients`)
        .query({ search: "managed", filter: "atRisk", sort: "-clickedAt", page: 1, perPage: 20 })
        .set("Cookie", cookie)
        .expect(200);

      expect(reportRequestsFor(campaign.id)).toEqual([
        expect.objectContaining({
          path: `/campaigns/${campaign.id}/report/recipients`,
          query: {
            search: ["managed"],
            filter: ["atRisk"],
            sort: ["-clickedAt"],
            page: ["1"],
            perPage: ["20"],
            groupIds: [organization.managedGroup.id],
          },
        }),
      ]);
      expect(response.body).toMatchObject({
        data: [
          {
            userId: organization.managedLearner.id,
            groupIds: [organization.managedGroup.id],
            courseStatus: COURSE_PROGRESS_STATUSES.IN_PROGRESS,
          },
        ],
        pagination: { totalItems: 1 },
      });
    });

    it("marks recipients without an enrollment as not enrolled", async () => {
      const organization = await arrangeOrganization();
      const campaign = arrangeCampaign(organization);
      const cookie = await loginAs(organization.admin);

      const response = await api()
        .get(`/api/phishing/campaigns/${campaign.id}/report/recipients`)
        .query({ search: "outside" })
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body.data).toEqual([
        expect.objectContaining({
          userId: organization.outsideLearner.id,
          groupIds: [organization.outsideGroup.id],
          courseStatus: COURSE_ENROLLMENT.NOT_ENROLLED,
        }),
      ]);
    });

    it("returns an empty page when a manager's search matches nobody in a campaign that reached them", async () => {
      const organization = await arrangeOrganization();
      const campaign = arrangeCampaign(organization);
      const cookie = await loginAs(organization.manager);

      const response = await api()
        .get(`/api/phishing/campaigns/${campaign.id}/report/recipients`)
        .query({ search: "nobody" })
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body).toMatchObject({ data: [], pagination: { totalItems: 0 } });
    });
  });
});
