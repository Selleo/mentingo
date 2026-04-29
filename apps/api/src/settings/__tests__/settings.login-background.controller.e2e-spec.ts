import { Readable } from "stream";

import { isNull, sql } from "drizzle-orm";
import sharp from "sharp";
import request from "supertest";

import { FileService } from "src/file/file.service";
import { FILE_DELIVERY_TYPE } from "src/file/types/file-delivery.type";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { settings } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { truncateTables, cookieFor } from "../../../test/helpers/test-helpers";

import type { DatabasePg } from "../../common";
import type { INestApplication } from "@nestjs/common";

describe("SettingsController - login background (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let fileService: FileService;
  let validPngBuffer: Buffer;
  let userFactory: ReturnType<typeof createUserFactory>;
  let globalSettingsFactory: ReturnType<typeof createSettingsFactory>;
  const testPassword = "Password123@@";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    fileService = app.get(FileService);
    userFactory = createUserFactory(db);
    globalSettingsFactory = createSettingsFactory(db, null);
    validPngBuffer = await sharp({
      create: {
        width: 16,
        height: 16,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();
  }, 20000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  describe("GET /api/settings/login-background", () => {
    beforeEach(async () => {
      await truncateTables(baseDb, ["settings"]);
      await globalSettingsFactory.create({ userId: null });
    });

    it("should return public login background url (null by default)", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/settings/login-background")
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.data).toEqual({ url: null });
    });
  });

  describe("PATCH /api/settings/login-background", () => {
    let adminUser: UserWithCredentials;
    let adminCookies: string[] | string;

    beforeEach(async () => {
      await truncateTables(baseDb, ["settings"]);
      await globalSettingsFactory.create({ userId: null });

      adminUser = await userFactory
        .withCredentials({ password: testPassword })
        .withAdminSettings(db)
        .create();

      const loginResponse = await request(app.getHttpServer()).post("/api/auth/login").send({
        email: adminUser.email,
        password: adminUser.credentials?.password,
      });
      adminCookies = loginResponse.headers["set-cookie"];
    });

    it("should reject non-admins with 403", async () => {
      const nonAdminUser = await userFactory
        .withCredentials({ password: testPassword })
        .withUserSettings(db)
        .create();
      const cookies = await cookieFor(nonAdminUser, app);

      await request(app.getHttpServer())
        .patch("/api/settings/login-background")
        .set("Cookie", cookies)
        .attach("login-background", validPngBuffer, {
          filename: "bg.png",
          contentType: "image/png",
        })
        .expect(403);
    });

    it("should clear login background key when PATCH is called without file", async () => {
      const fileKey = "login-backgrounds/old-bg.png";

      await db
        .update(settings)
        .set({
          settings: sql`
            jsonb_set(
              settings.settings,
              '{loginBackgroundImageS3Key}',
              to_jsonb(${fileKey}::text),
              true
            )
          `,
        })
        .where(isNull(settings.userId));

      await request(app.getHttpServer())
        .patch("/api/settings/login-background")
        .set("Cookie", Array.isArray(adminCookies) ? adminCookies : [adminCookies])
        .expect(200);

      const getResponse = await request(app.getHttpServer())
        .get("/api/settings/login-background")
        .expect(200);

      expect(getResponse.body).toBeDefined();
      expect(getResponse.body.data.url).toBeNull();

      const settingsRow = await db.query.settings.findFirst({
        where: (s, { isNull }) => isNull(s.userId),
      });

      expect(
        (settingsRow?.settings as { loginBackgroundImageS3Key?: string | null })
          .loginBackgroundImageS3Key,
      ).toBeNull();
    });
  });

  describe("GET /api/settings/login-background/image", () => {
    beforeEach(async () => {
      await truncateTables(baseDb, ["settings"]);
      await globalSettingsFactory.create({ userId: null });
    });

    it("should return 404 when login background image is not configured", async () => {
      await request(app.getHttpServer()).get("/api/settings/login-background/image").expect(404);
    });

    it("should return cached image response when login background is configured", async () => {
      const fileKey = "login-backgrounds/background.png";

      await db
        .update(settings)
        .set({
          settings: sql`
            jsonb_set(
              settings.settings,
              '{loginBackgroundImageS3Key}',
              to_jsonb(${fileKey}::text),
              true
            )
          `,
        })
        .where(isNull(settings.userId));

      const getFileDeliverySpy = jest.spyOn(fileService, "getFileDelivery").mockResolvedValue({
        type: FILE_DELIVERY_TYPE.STREAM,
        stream: Readable.from(validPngBuffer),
        contentType: "image/png",
        contentLength: validPngBuffer.length,
        acceptRanges: "bytes",
        etag: '"mock-etag"',
      });

      const response = await request(app.getHttpServer())
        .get("/api/settings/login-background/image")
        .expect(200);

      expect(response.headers["cache-control"]).toBe("public, max-age=86400");
      expect(response.headers["content-type"]).toContain("image/png");

      getFileDeliverySpy.mockRestore();
    });

    it("should return 304 with cache hit notification on matching if-none-match", async () => {
      const fileKey = "login-backgrounds/background.png";
      const etag = '"mock-etag"';

      await db
        .update(settings)
        .set({
          settings: sql`
            jsonb_set(
              settings.settings,
              '{loginBackgroundImageS3Key}',
              to_jsonb(${fileKey}::text),
              true
            )
          `,
        })
        .where(isNull(settings.userId));

      const getFileDeliverySpy = jest.spyOn(fileService, "getFileDelivery").mockResolvedValue({
        type: FILE_DELIVERY_TYPE.STREAM,
        stream: Readable.from(validPngBuffer),
        contentType: "image/png",
        contentLength: validPngBuffer.length,
        acceptRanges: "bytes",
        etag,
      });

      const response = await request(app.getHttpServer())
        .get("/api/settings/login-background/image")
        .set("If-None-Match", etag)
        .expect(304);

      expect(response.headers["cache-control"]).toBe("public, max-age=86400");
      expect(response.headers.etag).toBe(etag);

      getFileDeliverySpy.mockRestore();
    });
  });
});
