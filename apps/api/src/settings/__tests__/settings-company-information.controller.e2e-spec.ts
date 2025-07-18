import request from "supertest";

import { settings } from "../../../src/storage/schema";
import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { USER_ROLES } from "../../user/schemas/userRoles";

import type { DatabasePg } from "../../common";
import type { CompanyInformationBody } from "../schemas/company-information.schema";
import type { SettingsJSONContentSchema } from "../schemas/settings.schema";
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

  const validCompanyData: CompanyInformationBody = {
    company_name: "Test Company Ltd",
    registered_address: "123 Test Street, Test City",
    tax_number: "1234567890",
    email_address: "contact@testcompany.com",
    court_register_number: "KRS0000123456",
  };

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get("DB");
    userFactory = createUserFactory(db);
  }, 10000);

  afterAll(async () => {
    await app.close();
  }, 10000);

  beforeEach(async () => {
    await db.delete(settings);

    adminUser = await userFactory
      .withCredentials({ password: testPassword })
      .withAdminRole()
      .create();

    studentUser = await userFactory
      .withCredentials({ password: testPassword })
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
        .post("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(validCompanyData)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/settings/company-information")
        .expect(200);

      expect(response.body).toEqual(validCompanyData);
    });

    it("should return empty object when no company information exists", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/settings/company-information")
        .expect(200);

      expect(response.body).toEqual({});
    });

    it("should work for students (no authentication required)", async () => {
      await request(app.getHttpServer())
        .post("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(validCompanyData)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/settings/company-information")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(response.body).toEqual(validCompanyData);
    });

    it("should work for unauthenticated users", async () => {
      await request(app.getHttpServer())
        .post("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(validCompanyData)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get("/api/settings/company-information")
        .expect(200);

      expect(response.body).toEqual(validCompanyData);
    });
  });

  describe("POST /settings/company-information", () => {
    it("should create company information as admin", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(validCompanyData)
        .expect(201);

      expect(response.body.data.userId).toBeNull();
      expect(response.body.data.settings.company_information).toEqual(validCompanyData);
      expect(response.body.data.createdAt).toBeDefined();

      const globalSettings = await db.query.settings.findFirst({
        where: (s, { isNull }) => isNull(s.userId),
      });

      expect(globalSettings).toBeDefined();
      expect(globalSettings?.userId).toBeNull();
      expect((globalSettings?.settings as SettingsJSONContentSchema)?.company_information).toEqual(
        validCompanyData,
      );
    });

    it("should create company information with partial data", async () => {
      const partialData = {
        company_name: "Partial Company",
        email_address: "partial@company.com",
      };

      const response = await request(app.getHttpServer())
        .post("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(partialData)
        .expect(201);

      expect(response.body.data.settings.company_information).toEqual(partialData);
    });

    it("should return 409 when company information already exists", async () => {
      await request(app.getHttpServer())
        .post("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(validCompanyData)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send({
          company_name: "Another Company",
        })
        .expect(409);

      expect(response.body.message).toBe("Company information already exists");
      expect(response.body.statusCode).toBe(409);
    });

    it("should return 403 for student users", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/settings/company-information")
        .set("Cookie", studentCookies)
        .send(validCompanyData)
        .expect(403);

      expect(response.body.statusCode).toBe(403);
    });

    it("should return 401 for unauthenticated users", async () => {
      await request(app.getHttpServer())
        .post("/api/settings/company-information")
        .send(validCompanyData)
        .expect(401);
    });

    it("should return 400 for invalid data types", async () => {
      const invalidData = {
        company_name: 123,
        tax_number: true,
      };

      await request(app.getHttpServer())
        .post("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(invalidData)
        .expect(400);
    });
  });

  describe("PATCH /settings/company-information", () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(validCompanyData)
        .expect(201);
    });

    it("should update company information as admin", async () => {
      const updateData = {
        company_name: "Updated Company Name",
        email_address: "updated@company.com",
      };

      const response = await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(updateData)
        .expect(200);

      expect(response.body.data.settings.company_information).toEqual({
        ...validCompanyData,
        ...updateData,
      });

      const globalSettings = await db.query.settings.findFirst({
        where: (s, { isNull }) => isNull(s.userId),
      });

      expect((globalSettings?.settings as SettingsJSONContentSchema)?.company_information).toEqual({
        ...validCompanyData,
        ...updateData,
      });
    });

    it("should preserve existing fields when partially updating", async () => {
      const partialUpdate = {
        company_name: "Only Name Updated",
      };

      const response = await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(partialUpdate)
        .expect(200);

      const expectedData = {
        ...validCompanyData,
        company_name: "Only Name Updated",
      };

      expect(response.body.data.settings.company_information).toEqual(expectedData);
    });

    it("should return 404 when no company information exists to update", async () => {
      await db.delete(settings);

      const response = await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send({ company_name: "Test" })
        .expect(404);

      expect(response.body.message).toBe("Company information not found");
      expect(response.body.statusCode).toBe(404);
    });

    it("should return 403 for student users", async () => {
      const response = await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", studentCookies)
        .send({ company_name: "Unauthorized Update" })
        .expect(403);

      expect(response.body.statusCode).toBe(403);
    });

    it("should return 401 for unauthenticated users", async () => {
      await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .send({ company_name: "Unauthorized Update" })
        .expect(401);
    });

    it("should return 400 for invalid data types", async () => {
      const invalidData = {
        company_name: [],
        tax_number: {},
      };

      await request(app.getHttpServer())
        .patch("/api/settings/company-information")
        .set("Cookie", adminCookies)
        .send(invalidData)
        .expect(400);
    });
  });
});
