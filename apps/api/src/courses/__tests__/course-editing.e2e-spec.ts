import { COURSE_ORIGIN_TYPES, COURSE_TYPE, ENTITY_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { eq, inArray, isNull, sql } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { UpdateHasCertificateEvent } from "src/courses/events/updateHasCertificate.event";
import { EnvService } from "src/env/services/env.service";
import { CreateCourseEvent, UpdateCourseEvent } from "src/events";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { courses, coursesSummaryStats, resources, settings } from "src/storage/schema";
import { StripeService } from "src/stripe/stripe.service";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createResourceFactory } from "../../../test/factory/resource.factory";
import { createSecretFactory } from "../../../test/factory/secret.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { DEFAULT_E2E_GLOBAL_SETTINGS } from "../../../test/helpers/e2e-settings";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import {
  CERTIFICATE_VALIDITY_PERIOD,
  COURSE_AUTHORS,
  COURSE_EDIT_ACCESS_CASES,
  COURSE_EDIT_ENDPOINTS,
  COURSE_EDITORS,
  COURSE_FIELD_UPDATES,
  COURSE_KIND_DEFAULTS,
  EXPORTED_COURSE_SETTINGS_UPDATES,
  EXPORTED_COURSE_UPDATES,
  SCORM_UNAVAILABLE_SETTINGS,
} from "./course-editing.scenarios";

import type { CourseAuthor, CourseEditEndpoint, CourseEditor } from "./course-editing.scenarios";
import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const PASSWORD = "password123";
const STRIPE_SECRET_NAMES = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "VITE_STRIPE_PUBLISHABLE_KEY",
] as const;
const COURSE_EDITING_TABLES = [
  "users",
  "categories",
  "courses",
  "courses_summary_stats",
  "resources",
  "resource_entity",
  "secrets",
  "settings",
] as const;

const stripeServiceMock = {
  createProduct: jest.fn(),
  updateProduct: jest.fn(),
  createPrice: jest.fn(),
  updatePrice: jest.fn(),
};

const s3ServiceMock = {
  uploadFile: jest.fn(),
  getSignedUrl: jest.fn(),
  getFileContentType: jest.fn(),
  getFileExists: jest.fn(),
  deleteFile: jest.fn(),
};

const cacheManagerMock = { get: jest.fn(), set: jest.fn(), del: jest.fn() };

describe("Course editing (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let inTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let publishSpy: jest.SpyInstance;
  let userFactory: ReturnType<typeof createUserFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let resourceFactory: ReturnType<typeof createResourceFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let secretFactory: ReturnType<typeof createSecretFactory>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: StripeService, useValue: stripeServiceMock },
        { provide: S3Service, useValue: s3ServiceMock },
        { provide: "CACHE_MANAGER", useValue: cacheManagerMock },
      ],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    inTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    publishSpy = jest.spyOn(app.get(OutboxPublisher), "publish");

    userFactory = createUserFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    resourceFactory = createResourceFactory(db);
    settingsFactory = createSettingsFactory(db);
    secretFactory = createSecretFactory(app.get(EnvService));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, [...COURSE_EDITING_TABLES]);
    restoreProviderDoubles();

    await inTenant(() => settingsFactory.create({ userId: null }));
    await configureStripe({ enabled: false });
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, [...COURSE_EDITING_TABLES]);
  });

  const restoreProviderDoubles = () => {
    publishSpy.mockReset();
    Object.values(stripeServiceMock).forEach((mock) => mock.mockReset());
    Object.values(s3ServiceMock).forEach((mock) => mock.mockReset());
    Object.values(cacheManagerMock).forEach((mock) => mock.mockReset());

    stripeServiceMock.createProduct.mockResolvedValue({
      productId: "prod_created",
      priceId: "price_created",
    });
    stripeServiceMock.updateProduct.mockResolvedValue({});
    stripeServiceMock.createPrice.mockResolvedValue({ id: "price_replacement" });
    stripeServiceMock.updatePrice.mockResolvedValue({});
    s3ServiceMock.uploadFile.mockResolvedValue(undefined);
    s3ServiceMock.getSignedUrl.mockImplementation(
      async (key: string) => `https://storage.example.com/${key}`,
    );
    s3ServiceMock.getFileContentType.mockResolvedValue("image/png");
    s3ServiceMock.getFileExists.mockResolvedValue(true);
    s3ServiceMock.deleteFile.mockResolvedValue(undefined);
    cacheManagerMock.get.mockResolvedValue(undefined);
    cacheManagerMock.set.mockResolvedValue(undefined);
    cacheManagerMock.del.mockResolvedValue(undefined);
  };

  const configureStripe = ({ enabled }: { enabled: boolean }) =>
    inTenant(() =>
      Promise.all(
        STRIPE_SECRET_NAMES.map((name) =>
          secretFactory.create({ name, value: enabled ? `${name.toLowerCase()}_test` : "" }),
        ),
      ),
    );

  const arrangeEditor = (editor: CourseEditor): Promise<UserWithCredentials> =>
    inTenant(() =>
      match(editor)
        .with(COURSE_EDITORS.ADMIN, () =>
          userFactory.withCredentials({ password: PASSWORD }).withAdminSettings(db).create(),
        )
        .with(COURSE_EDITORS.CONTENT_CREATOR, () =>
          userFactory
            .withCredentials({ password: PASSWORD })
            .withContentCreatorSettings(db)
            .create(),
        )
        .with(COURSE_EDITORS.STUDENT, () =>
          userFactory.withCredentials({ password: PASSWORD }).withUserSettings(db).create(),
        )
        .exhaustive(),
    );

  const arrangeAuthorId = async (author: CourseAuthor, editor: UserWithCredentials) =>
    match(author)
      .with(COURSE_AUTHORS.EDITOR, async () => editor.id)
      .with(COURSE_AUTHORS.ANOTHER_USER, async () => {
        const anotherUser = await inTenant(() =>
          userFactory.withContentCreatorSettings(db).create(),
        );
        return anotherUser.id;
      })
      .exhaustive();

  const arrangeSignedInAdmin = async () => {
    const admin = await arrangeEditor(COURSE_EDITORS.ADMIN);
    return { admin, cookie: await cookieFor(admin, app) };
  };

  const arrangeCourse = (overrides: Parameters<typeof courseFactory.create>[0] = {}) =>
    inTenant(() => courseFactory.create({ thumbnailS3Key: null, ...overrides }));

  const findCourse = (courseId: UUIDType) =>
    inTenant(async () => {
      const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
      return course;
    });

  const publishedEvents = <TEvent>(eventClass: new (...args: never[]) => TEvent) =>
    publishSpy.mock.calls
      .map(([event]) => event)
      .filter((event): event is TEvent => event instanceof eventClass);

  const publishedCourseUpdates = (courseId: UUIDType) =>
    publishedEvents(UpdateCourseEvent).filter(
      (event) => event.courseUpdateData.courseId === courseId,
    );

  const sendCourseEdit = (endpoint: CourseEditEndpoint, courseId: UUIDType, cookie: string) => {
    const server = request(app.getHttpServer());

    return match(endpoint)
      .with(COURSE_EDIT_ENDPOINTS.UPDATE_COURSE, () =>
        server
          .patch(`/api/course/${courseId}`)
          .set("x-playwright-test", "true")
          .send({ language: SUPPORTED_LANGUAGES.EN, title: "Edited title" }),
      )
      .with(COURSE_EDIT_ENDPOINTS.UPDATE_HAS_CERTIFICATE, () =>
        server
          .patch(`/api/course/update-has-certificate/${courseId}`)
          .send({ hasCertificate: true }),
      )
      .with(COURSE_EDIT_ENDPOINTS.DELETE_TRAILER, () =>
        server.delete(`/api/course/${courseId}/trailer`),
      )
      .exhaustive()
      .set("Cookie", cookie);
  };

  describe("course edit access", () => {
    const accessCases = Object.values(COURSE_EDIT_ENDPOINTS).flatMap((endpoint) =>
      COURSE_EDIT_ACCESS_CASES.map((accessCase) => ({ endpoint, ...accessCase })),
    );

    it.each(accessCases)(
      "$endpoint responds $expectedStatus when $editor edits a course authored by $author",
      async ({ endpoint, editor, author, expectedStatus }) => {
        const currentEditor = await arrangeEditor(editor);
        const course = await arrangeCourse({
          authorId: await arrangeAuthorId(author, currentEditor),
        });
        const cookie = await cookieFor(currentEditor, app);

        await sendCourseEdit(endpoint, course.id, cookie).expect(expectedStatus);
      },
    );

    it.each(Object.values(COURSE_EDIT_ENDPOINTS))(
      "%s responds 404 for a course that does not exist",
      async (endpoint) => {
        const { cookie } = await arrangeSignedInAdmin();

        await sendCourseEdit(endpoint, "00000000-0000-4000-8000-000000000000", cookie).expect(404);
      },
    );
  });

  describe("PATCH /api/course/:id", () => {
    it.each(COURSE_FIELD_UPDATES)(
      "saves a changed $field in the requested language",
      async ({ body, expectedCourse }) => {
        const { admin, cookie } = await arrangeSignedInAdmin();
        const course = await arrangeCourse({ authorId: admin.id });

        await request(app.getHttpServer())
          .patch(`/api/course/${course.id}`)
          .set("x-playwright-test", "true")
          .set("Cookie", cookie)
          .send({ language: SUPPORTED_LANGUAGES.EN, ...body })
          .expect(200);

        expect(await findCourse(course.id)).toMatchObject(expectedCourse);
      },
    );

    it("moves the course to another existing category", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id });
      const category = await inTenant(() => categoryFactory.create());

      await request(app.getHttpServer())
        .patch(`/api/course/${course.id}`)
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send({ language: SUPPORTED_LANGUAGES.EN, categoryId: category.id })
        .expect(200);

      expect(await findCourse(course.id)).toMatchObject({ categoryId: category.id });
    });

    it("rejects a category that does not exist", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id });

      const response = await request(app.getHttpServer())
        .patch(`/api/course/${course.id}`)
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send({
          language: SUPPORTED_LANGUAGES.EN,
          categoryId: "00000000-0000-4000-8000-000000000000",
        })
        .expect(404);

      expect(response.body.message).toBe("adminCourseView.errors.notFound.category");
    });

    it("updates only the requested translation of a multilingual course", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({
        authorId: admin.id,
        title: "English title",
        availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.DE],
      });

      await request(app.getHttpServer())
        .patch(`/api/course/${course.id}`)
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send({ language: SUPPORTED_LANGUAGES.DE, title: "Deutscher Titel" })
        .expect(200);

      expect(await findCourse(course.id)).toMatchObject({
        title: {
          [SUPPORTED_LANGUAGES.EN]: "English title",
          [SUPPORTED_LANGUAGES.DE]: "Deutscher Titel",
        },
      });
    });

    it("rejects an update without a language", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id });

      const response = await request(app.getHttpServer())
        .patch(`/api/course/${course.id}`)
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send({ showAuthorSection: false })
        .expect(400);

      expect(response.body.message).toBe("adminCourseView.toast.updateCourseMissingLanguage");
    });

    it("rejects translated fields in a language the course does not support", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id });

      const response = await request(app.getHttpServer())
        .patch(`/api/course/${course.id}`)
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send({ language: SUPPORTED_LANGUAGES.DE, title: "Deutscher Titel" })
        .expect(400);

      expect(response.body.message).toBe("adminCourseView.toast.languageNotSupported");
    });

    it("accepts untranslated fields in a language the course does not support", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id });

      await request(app.getHttpServer())
        .patch(`/api/course/${course.id}`)
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send({ language: SUPPORTED_LANGUAGES.DE, showAuthorSection: false })
        .expect(200);

      expect(await findCourse(course.id)).toMatchObject({ showAuthorSection: false });
    });

    it.each(EXPORTED_COURSE_UPDATES)(
      "responds $expectedStatus when changing the $change of a course exported from a master course",
      async ({ body, expectedStatus }) => {
        await configureStripe({ enabled: true });
        const { admin, cookie } = await arrangeSignedInAdmin();
        const course = await arrangeCourse({
          authorId: admin.id,
          originType: COURSE_ORIGIN_TYPES.EXPORTED,
        });

        await request(app.getHttpServer())
          .patch(`/api/course/${course.id}`)
          .set("x-playwright-test", "true")
          .set("Cookie", cookie)
          .send({ language: SUPPORTED_LANGUAGES.EN, ...body })
          .expect(expectedStatus);
      },
    );

    it("publishes the previous and updated course snapshots", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id, title: "Before" });

      await request(app.getHttpServer())
        .patch(`/api/course/${course.id}`)
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send({ language: SUPPORTED_LANGUAGES.EN, title: "After" })
        .expect(200);

      expect(publishedCourseUpdates(course.id)).toEqual([
        expect.objectContaining({
          courseUpdateData: expect.objectContaining({
            actor: expect.objectContaining({ userId: admin.id }),
            previousCourseData: expect.objectContaining({ id: course.id, title: "Before" }),
            updatedCourseData: expect.objectContaining({ id: course.id, title: "After" }),
          }),
        }),
      ]);
    });

    it("does not publish an update when nothing changed", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id, showAuthorSection: true });

      await request(app.getHttpServer())
        .patch(`/api/course/${course.id}`)
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send({ language: SUPPORTED_LANGUAGES.EN, showAuthorSection: true })
        .expect(200);

      expect(publishedCourseUpdates(course.id)).toEqual([]);
    });

    describe("Stripe synchronization", () => {
      const arrangeStripeCourse = async (
        overrides: Parameters<typeof courseFactory.create>[0] = {},
      ) => {
        await configureStripe({ enabled: true });
        const { admin, cookie } = await arrangeSignedInAdmin();
        const course = await arrangeCourse({
          authorId: admin.id,
          title: "Stripe course",
          description: "Stripe description",
          priceInCents: 1000,
          currency: "usd",
          stripeProductId: "prod_existing",
          stripePriceId: "price_existing",
          ...overrides,
        });

        return { course, cookie };
      };

      it("ignores price changes while Stripe is not configured", async () => {
        const { admin, cookie } = await arrangeSignedInAdmin();
        const course = await arrangeCourse({ authorId: admin.id, priceInCents: 1000 });

        await request(app.getHttpServer())
          .patch(`/api/course/${course.id}`)
          .set("Cookie", cookie)
          .send({
            language: SUPPORTED_LANGUAGES.EN,
            showAuthorSection: false,
            priceInCents: 4200,
            currency: "eur",
          })
          .expect(200);

        expect(await findCourse(course.id)).toMatchObject({
          showAuthorSection: false,
          priceInCents: 1000,
          currency: "usd",
        });
        expect(stripeServiceMock.createPrice).not.toHaveBeenCalled();
      });

      it("fails when only the price changes while Stripe is not configured", async () => {
        const { admin, cookie } = await arrangeSignedInAdmin();
        const course = await arrangeCourse({ authorId: admin.id, priceInCents: 1000 });

        await request(app.getHttpServer())
          .patch(`/api/course/${course.id}`)
          .set("Cookie", cookie)
          .send({ language: SUPPORTED_LANGUAGES.EN, priceInCents: 4200 })
          .expect(500);

        expect(await findCourse(course.id)).toMatchObject({ priceInCents: 1000 });
      });

      it("saves the price without calling Stripe for Playwright requests", async () => {
        const { course, cookie } = await arrangeStripeCourse();

        await request(app.getHttpServer())
          .patch(`/api/course/${course.id}`)
          .set("x-playwright-test", "true")
          .set("Cookie", cookie)
          .send({ language: SUPPORTED_LANGUAGES.EN, priceInCents: 4200 })
          .expect(200);

        expect(await findCourse(course.id)).toMatchObject({
          priceInCents: 4200,
          stripePriceId: "price_existing",
        });
        expect(stripeServiceMock.createPrice).not.toHaveBeenCalled();
      });

      it("creates a Stripe product for a course that has none", async () => {
        const { course, cookie } = await arrangeStripeCourse({
          stripeProductId: null,
          stripePriceId: null,
        });

        await request(app.getHttpServer())
          .patch(`/api/course/${course.id}`)
          .set("Cookie", cookie)
          .send({ language: SUPPORTED_LANGUAGES.EN, showAuthorSection: false })
          .expect(200);

        expect(stripeServiceMock.createProduct).toHaveBeenCalledWith({
          name: "Stripe course",
          description: "Stripe description",
          amountInCents: 1000,
          currency: "usd",
        });
        expect(await findCourse(course.id)).toMatchObject({
          stripeProductId: "prod_created",
          stripePriceId: "price_created",
        });
      });

      it("renames the Stripe product when the base language changes", async () => {
        const { course, cookie } = await arrangeStripeCourse();

        await request(app.getHttpServer())
          .patch(`/api/course/${course.id}`)
          .set("Cookie", cookie)
          .send({ language: SUPPORTED_LANGUAGES.EN, title: "Renamed course" })
          .expect(200);

        expect(stripeServiceMock.updateProduct).toHaveBeenCalledWith("prod_existing", {
          name: "Renamed course",
          description: "Stripe description",
        });
      });

      it("leaves the Stripe product alone when a translation changes", async () => {
        const { course, cookie } = await arrangeStripeCourse({
          availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.DE],
        });

        await request(app.getHttpServer())
          .patch(`/api/course/${course.id}`)
          .set("Cookie", cookie)
          .send({ language: SUPPORTED_LANGUAGES.DE, title: "Deutscher Titel" })
          .expect(200);

        expect(stripeServiceMock.updateProduct).not.toHaveBeenCalled();
      });

      it("replaces the Stripe price and deactivates the previous one", async () => {
        const { course, cookie } = await arrangeStripeCourse();

        await request(app.getHttpServer())
          .patch(`/api/course/${course.id}`)
          .set("Cookie", cookie)
          .send({ language: SUPPORTED_LANGUAGES.EN, priceInCents: 4200, currency: "eur" })
          .expect(200);

        expect(stripeServiceMock.createPrice).toHaveBeenCalledWith({
          product: "prod_existing",
          currency: "eur",
          unit_amount: 4200,
        });
        expect(stripeServiceMock.updatePrice).toHaveBeenCalledWith("price_existing", {
          active: false,
        });
        expect(await findCourse(course.id)).toMatchObject({
          priceInCents: 4200,
          currency: "eur",
          stripePriceId: "price_replacement",
        });
      });

      it("keeps the previous Stripe price when Stripe returns no new price", async () => {
        stripeServiceMock.createPrice.mockResolvedValue({});
        const { course, cookie } = await arrangeStripeCourse();

        await request(app.getHttpServer())
          .patch(`/api/course/${course.id}`)
          .set("Cookie", cookie)
          .send({ language: SUPPORTED_LANGUAGES.EN, priceInCents: 4200 })
          .expect(200);

        expect(stripeServiceMock.updatePrice).not.toHaveBeenCalled();
        expect(await findCourse(course.id)).toMatchObject({ stripePriceId: "price_existing" });
      });
    });
  });

  describe("POST /api/course", () => {
    const arrangeCourseDraft = async () => {
      const category = await inTenant(() => categoryFactory.create());

      return {
        title: "New course",
        description: "New course description",
        categoryId: category.id,
        language: SUPPORTED_LANGUAGES.EN,
        priceInCents: 1500,
      };
    };

    it.each(COURSE_KIND_DEFAULTS)(
      "creates a $kind course with its default settings",
      async ({ isScorm, expectedCourse }) => {
        const { cookie } = await arrangeSignedInAdmin();
        const draft = await arrangeCourseDraft();

        const response = await request(app.getHttpServer())
          .post("/api/course")
          .set("x-playwright-test", "true")
          .set("Cookie", cookie)
          .send({ ...draft, isScorm })
          .expect(201);

        expect(await findCourse(response.body.data.id)).toMatchObject(expectedCourse);
      },
    );

    it("stores the course in the requested language for its author", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const draft = await arrangeCourseDraft();

      const response = await request(app.getHttpServer())
        .post("/api/course")
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send({
          ...draft,
          language: SUPPORTED_LANGUAGES.DE,
          learningOutcomes: ["Lernziel"],
        })
        .expect(201);

      expect(await findCourse(response.body.data.id)).toMatchObject({
        title: { [SUPPORTED_LANGUAGES.DE]: "New course" },
        description: { [SUPPORTED_LANGUAGES.DE]: "New course description" },
        learningOutcomes: { [SUPPORTED_LANGUAGES.DE]: ["Lernziel"] },
        baseLanguage: SUPPORTED_LANGUAGES.DE,
        availableLocales: [SUPPORTED_LANGUAGES.DE],
        authorId: admin.id,
        priceInCents: 1500,
        currency: DEFAULT_E2E_GLOBAL_SETTINGS.defaultCourseCurrency,
        stripeProductId: null,
        stripePriceId: null,
      });
    });

    it("creates empty summary statistics for the new course", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();

      const response = await request(app.getHttpServer())
        .post("/api/course")
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send(await arrangeCourseDraft())
        .expect(201);

      const summaryStats = await inTenant(() =>
        db
          .select({
            courseId: coursesSummaryStats.courseId,
            authorId: coursesSummaryStats.authorId,
          })
          .from(coursesSummaryStats)
          .where(eq(coursesSummaryStats.courseId, response.body.data.id)),
      );

      expect(summaryStats).toEqual([{ courseId: response.body.data.id, authorId: admin.id }]);
    });

    it("uses the organization default currency", async () => {
      const { cookie } = await arrangeSignedInAdmin();
      await inTenant(() =>
        db
          .update(settings)
          .set({
            settings: sql`${settings.settings} || jsonb_build_object('defaultCourseCurrency', 'eur')`,
          })
          .where(isNull(settings.userId)),
      );

      const response = await request(app.getHttpServer())
        .post("/api/course")
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send(await arrangeCourseDraft())
        .expect(201);

      expect(await findCourse(response.body.data.id)).toMatchObject({ currency: "eur" });
    });

    it("falls back to US dollars when the organization has no default currency", async () => {
      const { cookie } = await arrangeSignedInAdmin();
      await inTenant(() =>
        db
          .update(settings)
          .set({ settings: sql`${settings.settings} - 'defaultCourseCurrency'` })
          .where(isNull(settings.userId)),
      );

      const response = await request(app.getHttpServer())
        .post("/api/course")
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send(await arrangeCourseDraft())
        .expect(201);

      expect(await findCourse(response.body.data.id)).toMatchObject({ currency: "usd" });
    });

    it("rejects a category that does not exist", async () => {
      const { cookie } = await arrangeSignedInAdmin();
      const draft = await arrangeCourseDraft();

      const response = await request(app.getHttpServer())
        .post("/api/course")
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send({ ...draft, categoryId: "00000000-0000-4000-8000-000000000000" })
        .expect(404);

      expect(response.body.message).toBe("adminCourseView.errors.notFound.category");
    });

    it("lets a content creator create a course they author", async () => {
      const contentCreator = await arrangeEditor(COURSE_EDITORS.CONTENT_CREATOR);
      const cookie = await cookieFor(contentCreator, app);

      const response = await request(app.getHttpServer())
        .post("/api/course")
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send(await arrangeCourseDraft())
        .expect(201);

      expect(await findCourse(response.body.data.id)).toMatchObject({
        authorId: contentCreator.id,
      });
    });

    it("forbids students from creating courses", async () => {
      const student = await arrangeEditor(COURSE_EDITORS.STUDENT);
      const cookie = await cookieFor(student, app);

      await request(app.getHttpServer())
        .post("/api/course")
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send(await arrangeCourseDraft())
        .expect(403);
    });

    it("publishes the created course snapshot", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();

      const response = await request(app.getHttpServer())
        .post("/api/course")
        .set("x-playwright-test", "true")
        .set("Cookie", cookie)
        .send(await arrangeCourseDraft())
        .expect(201);

      const createdCourseEvents = publishedEvents(CreateCourseEvent).filter(
        (event) => event.courseCreationData.courseId === response.body.data.id,
      );

      expect(createdCourseEvents).toEqual([
        expect.objectContaining({
          courseCreationData: expect.objectContaining({
            actor: expect.objectContaining({ userId: admin.id }),
            createdCourse: expect.objectContaining({
              id: response.body.data.id,
              title: "New course",
            }),
          }),
        }),
      ]);
    });

    it("creates a Stripe product for the course when Stripe is configured", async () => {
      await configureStripe({ enabled: true });
      const { cookie } = await arrangeSignedInAdmin();

      const response = await request(app.getHttpServer())
        .post("/api/course")
        .set("Cookie", cookie)
        .send(await arrangeCourseDraft())
        .expect(201);

      expect(stripeServiceMock.createProduct).toHaveBeenCalledWith({
        name: "New course",
        description: "New course description",
        currency: DEFAULT_E2E_GLOBAL_SETTINGS.defaultCourseCurrency,
        amountInCents: 1500,
      });
      expect(await findCourse(response.body.data.id)).toMatchObject({
        stripeProductId: "prod_created",
        stripePriceId: "price_created",
      });
    });

    it("does not create the course when Stripe returns no product", async () => {
      await configureStripe({ enabled: true });
      stripeServiceMock.createProduct.mockResolvedValue({ productId: null, priceId: null });
      const { cookie } = await arrangeSignedInAdmin();

      const response = await request(app.getHttpServer())
        .post("/api/course")
        .set("Cookie", cookie)
        .send(await arrangeCourseDraft())
        .expect(500);

      const createdCourses = await inTenant(() => db.select({ id: courses.id }).from(courses));

      expect(response.body.message).toBe("adminCourseView.errors.create.stripeProductFailed");
      expect(createdCourses).toEqual([]);
    });
  });

  describe("PATCH /api/course/update-has-certificate/:id", () => {
    const updateHasCertificate = (courseId: UUIDType, hasCertificate: boolean, cookie: string) =>
      request(app.getHttpServer())
        .patch(`/api/course/update-has-certificate/${courseId}`)
        .set("Cookie", cookie)
        .send({ hasCertificate });

    const publishedCertificateEnables = (courseId: UUIDType) =>
      publishedEvents(UpdateHasCertificateEvent).filter(
        (event) => event.courseData.courseId === courseId,
      );

    it("enables certificates and announces it", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id, hasCertificate: false });

      await updateHasCertificate(course.id, true, cookie).expect(200);

      expect(await findCourse(course.id)).toMatchObject({ hasCertificate: true });
      expect(publishedCertificateEnables(course.id)).toEqual([
        new UpdateHasCertificateEvent({ courseId: course.id, tenantId: admin.tenantId }),
      ]);
      expect(publishedCourseUpdates(course.id)).toHaveLength(1);
    });

    it("disables certificates without announcing certificate availability", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id, hasCertificate: true });

      await updateHasCertificate(course.id, false, cookie).expect(200);

      expect(await findCourse(course.id)).toMatchObject({ hasCertificate: false });
      expect(publishedCertificateEnables(course.id)).toEqual([]);
      expect(publishedCourseUpdates(course.id)).toHaveLength(1);
    });

    it("announces certificate availability again without a course update when already enabled", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id, hasCertificate: true });

      await updateHasCertificate(course.id, true, cookie).expect(200);

      expect(publishedCertificateEnables(course.id)).toHaveLength(1);
      expect(publishedCourseUpdates(course.id)).toEqual([]);
    });
  });

  describe("DELETE /api/course/:id/trailer", () => {
    const arrangeTrailer = (courseId: UUIDType, relationshipType: string) =>
      inTenant(() =>
        resourceFactory
          .linkedTo({ entityId: courseId, entityType: ENTITY_TYPES.COURSE, relationshipType })
          .create({ reference: `course/${courseId}/trailer.mp4`, contentType: "video/mp4" }),
      );

    const findArchivedFlags = (resourceIds: UUIDType[]) =>
      inTenant(() =>
        db
          .select({ id: resources.id, archived: resources.archived })
          .from(resources)
          .where(inArray(resources.id, resourceIds)),
      );

    it("archives the course trailer but keeps its other resources and other trailers", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id });
      const otherCourse = await arrangeCourse({ authorId: admin.id });
      const trailer = await arrangeTrailer(course.id, RESOURCE_RELATIONSHIP_TYPES.TRAILER);
      const attachment = await arrangeTrailer(course.id, RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT);
      const otherTrailer = await arrangeTrailer(
        otherCourse.id,
        RESOURCE_RELATIONSHIP_TYPES.TRAILER,
      );

      const response = await request(app.getHttpServer())
        .delete(`/api/course/${course.id}/trailer`)
        .set("Cookie", cookie)
        .expect(200);

      expect(response.body.data).toEqual({ message: "Course trailer removed successfully" });
      expect(await findArchivedFlags([trailer.id, attachment.id, otherTrailer.id])).toEqual(
        expect.arrayContaining([
          { id: trailer.id, archived: true },
          { id: attachment.id, archived: false },
          { id: otherTrailer.id, archived: false },
        ]),
      );
    });

    it("succeeds when the course has no trailer", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id });

      await request(app.getHttpServer())
        .delete(`/api/course/${course.id}/trailer`)
        .set("Cookie", cookie)
        .expect(200);
    });

    it("forbids removing the trailer of a course exported from a master course", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({
        authorId: admin.id,
        originType: COURSE_ORIGIN_TYPES.EXPORTED,
      });
      const trailer = await arrangeTrailer(course.id, RESOURCE_RELATIONSHIP_TYPES.TRAILER);

      const response = await request(app.getHttpServer())
        .delete(`/api/course/${course.id}/trailer`)
        .set("Cookie", cookie)
        .expect(403);

      expect(response.body.message).toBe("masterCourse.error.exportedCourseReadonly");
      expect(await findArchivedFlags([trailer.id])).toEqual([{ id: trailer.id, archived: false }]);
    });
  });

  describe("PATCH /api/course/settings/:courseId", () => {
    const updateSettings = (courseId: UUIDType, cookie: string) =>
      request(app.getHttpServer()).patch(`/api/course/settings/${courseId}`).set("Cookie", cookie);

    it.each(SCORM_UNAVAILABLE_SETTINGS)(
      "rejects $setting for SCORM courses",
      async ({ body, expectedMessage }) => {
        const { admin, cookie } = await arrangeSignedInAdmin();
        const course = await arrangeCourse({ authorId: admin.id, courseType: COURSE_TYPE.SCORM });

        const response = await updateSettings(course.id, cookie).send(body).expect(400);

        expect(response.body.message).toBe(expectedMessage);
      },
    );

    it.each(EXPORTED_COURSE_SETTINGS_UPDATES)(
      "responds $expectedStatus when changing the $change of a course exported from a master course",
      async ({ body, expectedStatus }) => {
        const { admin, cookie } = await arrangeSignedInAdmin();
        const course = await arrangeCourse({
          authorId: admin.id,
          originType: COURSE_ORIGIN_TYPES.EXPORTED,
        });

        await updateSettings(course.id, cookie).send(body).expect(expectedStatus);
      },
    );

    it("removes the stored certificate signature", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id });
      await inTenant(() =>
        db
          .update(courses)
          .set({
            settings: sql`${courses.settings} || jsonb_build_object('certificateSignature', 'certificate/signature.png')`,
          })
          .where(eq(courses.id, course.id)),
      );

      await updateSettings(course.id, cookie)
        .send({ removeCertificateSignature: true })
        .expect(200);

      expect(await findCourse(course.id)).toMatchObject({
        settings: { certificateSignature: null },
      });
    });

    it("stores a certificate validity and applies it to existing certificates", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id });

      await updateSettings(course.id, cookie)
        .send({
          certificateValidity: CERTIFICATE_VALIDITY_PERIOD,
          applyValidityToExistingCertificates: true,
        })
        .expect(200);

      expect(await findCourse(course.id)).toMatchObject({
        settings: { certificateValidity: CERTIFICATE_VALIDITY_PERIOD },
      });
    });

    it("clears the certificate validity", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id });
      await inTenant(() =>
        db
          .update(courses)
          .set({
            settings: sql`${courses.settings} || jsonb_build_object('certificateValidity', ${JSON.stringify(CERTIFICATE_VALIDITY_PERIOD)}::text::jsonb)`,
          })
          .where(eq(courses.id, course.id)),
      );

      await updateSettings(course.id, cookie).send({ certificateValidity: null }).expect(200);

      expect(await findCourse(course.id)).toMatchObject({
        settings: { certificateValidity: null },
      });
    });

    it("does not publish an update when the settings did not change", async () => {
      const { admin, cookie } = await arrangeSignedInAdmin();
      const course = await arrangeCourse({ authorId: admin.id });

      await updateSettings(course.id, cookie)
        .send({ certificateFontColor: course.settings.certificateFontColor })
        .expect(200);

      expect(publishedCourseUpdates(course.id)).toEqual([]);
    });
  });
});
