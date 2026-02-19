import request from "supertest";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import { createAiMentorLessonFactory } from "./createAiMentorLesson";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

describe("AiController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let aiRepository: AiRepository;

  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let aiMentorLessonFactory: ReturnType<typeof createAiMentorLessonFactory>;

  const password = "password123";

  beforeAll(async () => {
    const { app: testApp, moduleFixture } = await createE2ETest();
    app = testApp;

    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    aiRepository = moduleFixture.get(AiRepository);

    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    aiMentorLessonFactory = createAiMentorLessonFactory(db);
  }, 30000);

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  describe("GET /api/ai/thread", () => {
    let threadId: UUIDType;
    let threadOwner: UserWithCredentials;

    beforeAll(async () => {
      threadOwner = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });

      const aiMentorLesson = await aiMentorLessonFactory.create();

      const thread = await aiRepository.createThread({
        userId: threadOwner.id,
        aiMentorLessonId: aiMentorLesson.id,
        status: THREAD_STATUS.ACTIVE,
        userLanguage: "en",
      });

      threadId = thread.id;
    });

    it("returns thread when user owns it", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/ai/thread?thread=${threadId}`)
        .set("Cookie", await cookieFor(threadOwner, app))
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(threadId);
    });

    it("returns 401 when not authenticated", async () => {
      await request(app.getHttpServer()).get(`/api/ai/thread?thread=${threadId}`).expect(401);
    });

    it("returns 404 for non-existent thread", async () => {
      const user = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });

      const fakeThreadId = "00000000-0000-0000-0000-000000000000";

      await request(app.getHttpServer())
        .get(`/api/ai/thread?thread=${fakeThreadId}`)
        .set("Cookie", await cookieFor(user, app))
        .expect(404);
    });

    it("returns 403 when accessing another user's thread", async () => {
      const otherUser = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });

      await request(app.getHttpServer())
        .get(`/api/ai/thread?thread=${threadId}`)
        .set("Cookie", await cookieFor(otherUser, app))
        .expect(403);
    });

    it("allows admin to access any thread", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });

      const response = await request(app.getHttpServer())
        .get(`/api/ai/thread?thread=${threadId}`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data.id).toBe(threadId);
    });
  });

  describe("GET /api/ai/thread/messages", () => {
    let threadId: UUIDType;
    let threadOwner: UserWithCredentials;

    beforeAll(async () => {
      threadOwner = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });

      const aiMentorLesson = await aiMentorLessonFactory.create();

      const thread = await aiRepository.createThread({
        userId: threadOwner.id,
        aiMentorLessonId: aiMentorLesson.id,
        status: THREAD_STATUS.ACTIVE,
        userLanguage: "en",
      });

      threadId = thread.id;

      // Insert a test message
      await aiRepository.insertMessage({
        threadId: thread.id,
        role: "user",
        content: "Test message",
        tokenCount: 2,
      });
    });

    it("returns messages for thread owner", async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/ai/thread/messages?thread=${threadId}`)
        .set("Cookie", await cookieFor(threadOwner, app))
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it("returns 401 when not authenticated", async () => {
      await request(app.getHttpServer())
        .get(`/api/ai/thread/messages?thread=${threadId}`)
        .expect(401);
    });

    it("returns 403 when accessing another user's thread messages", async () => {
      const otherUser = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });

      await request(app.getHttpServer())
        .get(`/api/ai/thread/messages?thread=${threadId}`)
        .set("Cookie", await cookieFor(otherUser, app))
        .expect(403);
    });
  });
});
