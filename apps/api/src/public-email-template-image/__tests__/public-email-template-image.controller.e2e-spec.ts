import request from "supertest";

import { RESOURCE_CATEGORIES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { DEFAULT_TEST_TENANT_HOST } from "../../../test/helpers/tenant-helpers";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("PublicEmailTemplateImageController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let defaultTenantId: string;

  const mockFileService = {
    getImageUrlByQuality: jest.fn(),
  };

  beforeAll(async () => {
    const result = await createE2ETest([{ provide: FileService, useValue: mockFileService }]);
    app = result.app;
    db = result.db;
    baseDb = app.get(DB_ADMIN);
    defaultTenantId = result.defaultTenantId;
    settingsFactory = createSettingsFactory(db);
  }, 30000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  beforeEach(async () => {
    jest.clearAllMocks();
    await settingsFactory.create({ userId: null });
  });

  afterEach(async () => {
    await truncateAllTables(baseDb, db);
  });

  describe("GET /api/public/email-template-image/:reference", () => {
    it("redirects 302 to a signed URL when reference matches the Host tenant", async () => {
      const signedUrl = "https://s3.example.com/signed-url?X-Amz-Expires=3600";
      mockFileService.getImageUrlByQuality.mockResolvedValue(signedUrl);

      const validRef = `${defaultTenantId}/${RESOURCE_CATEGORIES.EMAIL_TEMPLATE_IMAGE}/variants/uuid.webp`;

      const response = await request(app.getHttpServer())
        .get(`/api/public/email-template-image/${encodeURIComponent(validRef)}`)
        .set("Referer", `${DEFAULT_TEST_TENANT_HOST}/`)
        .redirects(0)
        .expect(302);

      expect(response.headers.location).toBe(signedUrl);
      expect(response.headers["cache-control"]).toContain("max-age=1800");
    });

    it("returns placeholder SVG when reference belongs to a different tenant", async () => {
      const alienTenantId = "99999999-9999-9999-9999-999999999999";
      const alienRef = `${alienTenantId}/${RESOURCE_CATEGORIES.EMAIL_TEMPLATE_IMAGE}/variants/uuid.webp`;

      const response = await request(app.getHttpServer())
        .get(`/api/public/email-template-image/${encodeURIComponent(alienRef)}`)
        .set("Referer", `${DEFAULT_TEST_TENANT_HOST}/`)
        .expect(200);

      expect(response.headers["content-type"]).toContain("image/svg+xml");
      expect(response.headers["cache-control"]).toContain("max-age=3600");
      expect(response.text).toContain("<svg");
      expect(mockFileService.getImageUrlByQuality).not.toHaveBeenCalled();
    });
  });
});
