import request from "supertest";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { USER_ROLES } from "../../user/schemas/userRoles";

import type { DatabasePg } from "../../common";
import type { CompanyInformaitonJSONSchema } from "../schemas/company-information.schema";
import type { GlobalSettingsJSONContentSchema } from "../schemas/settings.schema";
import type { INestApplication } from "@nestjs/common";

describe("SettingsController - Company Information (e2e)", () => {
  let app: INestApplication;
  let adminUser: UserWithCredentials;
  let studentUser: UserWithCredentials;
  let adminCookies: string;
  let studentCookies: string;
  const testPassword = "Password123@@";
  let db: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let globalSettingsFactory: ReturnType<typeof createSettingsFactory>;

  const validCompanyData: CompanyInformaitonJSONSchema = {
    companyName: "Test Company Ltd",
    companyShortName: "",
    registeredAddress: "123 Test Street, Test City",
    taxNumber: "1234567890",
    emailAddress: "contact@testcompany.com",
    courtRegisterNumber: "KRS0000123456",
  };

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get("DB");
    userFactory = createUserFactory(db);
    globalSettingsFactory = createSettingsFactory(db, null);
  }, 10000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  beforeEach(async () => {
    await truncateTables(db, ["settings"]);

    await globalSettingsFactory.create();

    adminUser = await userFactory
      .withCredentials({ password: testPassword })
      .withAdminSettings(db)
      .withAdminRole()
      .create();

    studentUser = await userFactory
      .withCredentials({ password: testPassword })
      .withUserSettings(db)
      .associations({ role: USER_ROLES.STUDENT })
      .create();

    const adminLoginResponse = await request(app.getHttpServer()).post("/api/auth/login").send({
      email: adminUser.email,
      password: adminUser.credentials?.password,
    });
    adminCookies = adminLoginResponse.headers["set-cookie"];

    const studentLoginResponse = await request(app.getHttpServer()).post("/api/auth/login").send({
      email: studentUser.email,
      password: studentUser.credentials?.password,
    });
    studentCookies = studentLoginResponse.headers["set-cookie"];
  });

  describe("GET /settings/company-information", () => {
    it("should return company information when it exists", async () => {
      await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(validCompanyData)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/api/settings/company-information")
        .expect(200);

      expect(response.body.data).toEqual(validCompanyData);
    });

    it("should return empty object when no company information exists", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/settings/company-information")
        .expect(200);

      expect(response.body.data).toEqual({
        companyName: "",
        companyShortName: "",
        registeredAddress: "",
        taxNumber: "",
        emailAddress: "",
        courtRegisterNumber: "",
      });
    });

    it("should work for students (no authentication required)", async () => {
      await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(validCompanyData)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/api/settings/company-information")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(response.body.data).toEqual(validCompanyData);
    });

    it("should work for unauthenticated users", async () => {
      await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(validCompanyData)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get("/api/settings/company-information")
        .expect(200);

      expect(response.body.data).toEqual(validCompanyData);
    });
  });

  describe("PATCH /settings/company-information", () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(validCompanyData)
        .expect(200);
    });

    it("should update company information as admin", async () => {
      const updateData = {
        companyName: "Updated Company Name",
        emailAddress: "updated@company.com",
      };

      const response = await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(updateData)
        .expect(200);

      expect(response.body.data).toEqual({
        ...validCompanyData,
        ...updateData,
      });

      const globalSettings = await db.query.settings.findFirst({
        where: (s, { isNull }) => isNull(s.userId),
      });

      expect(
        (globalSettings?.settings as GlobalSettingsJSONContentSchema)?.companyInformation,
      ).toEqual({
        ...validCompanyData,
        ...updateData,
      });
    });

    it("should preserve existing fields when partially updating", async () => {
      const partialUpdate = {
        companyName: "Only Name Updated",
      };

      const response = await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(partialUpdate)
        .expect(200);

      const expectedData = {
        ...validCompanyData,
        companyName: "Only Name Updated",
      };

      expect(response.body.data).toEqual(expectedData);
    });

    it("should return 404 when no company information exists to update", async () => {
      await truncateTables(db, ["settings"]);

      const response = await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send({ companyName: "Test" })
        .expect(404);

      expect(response.body.message).toBe("Company information not found");
      expect(response.body.statusCode).toBe(404);
    });

    it("should return 403 for student users", async () => {
      const response = await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", studentCookies)
        .send({ companyName: "Unauthorized Update" })
        .expect(403);

      expect(response.body.statusCode).toBe(403);
    });

    it("should return 401 for unauthenticated users", async () => {
      await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .send({ companyName: "Unauthorized Update" })
        .expect(401);
    });

    it("should return 400 for invalid data types", async () => {
      const invalidData = {
        companyName: [],
        taxNumber: {},
      };

      await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(invalidData)
        .expect(400);
    });
  });
});
