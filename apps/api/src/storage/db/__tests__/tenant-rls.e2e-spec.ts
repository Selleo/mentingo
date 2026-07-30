import request from "supertest";

import { createE2ETest } from "../../../../test/create-e2e-test";
import { createUserFactory } from "../../../../test/factory/user.factory";
import { tenants } from "../../schema";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

describe("tenant RLS isolation (e2e)", () => {
  let app: INestApplication;
  let dbAdmin: DatabasePg;
  let defaultTenantId: UUIDType;

  beforeAll(async () => {
    const testContext = await createE2ETest({ useDbProxy: true });
    app = testContext.app;
    dbAdmin = testContext.dbAdmin;
    defaultTenantId = testContext.defaultTenantId;
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns each tenant's own user for the same email", async () => {
    const secondTenantHost = `https://tenant-${crypto.randomUUID()}.local`;
    const [secondTenant] = await dbAdmin
      .insert(tenants)
      .values({ name: "Second isolation tenant", host: secondTenantHost })
      .returning({ id: tenants.id });

    const email = `same-email-${crypto.randomUUID()}@example.com`;
    const password = "Password123@";
    const userFactory = createUserFactory(dbAdmin).withCredentials({ password });

    const firstTenantUser = await userFactory.create({
      email,
      firstName: "First tenant",
      tenantId: defaultTenantId,
    });
    const secondTenantUser = await userFactory.create({
      email,
      firstName: "Second tenant",
      tenantId: secondTenant.id,
    });

    const login = async (host: string) => {
      const response = await request(app.getHttpServer())
        .post("/api/auth/login")
        .set("Referer", `${host}/`)
        .send({ email, password })
        .expect(201);

      return {
        cookies: response.headers["set-cookie"],
        account: response.body.data,
      };
    };

    const firstLogin = await login("https://tenant.local");
    const secondLogin = await login(secondTenantHost);

    expect(firstLogin.account.id).toBe(firstTenantUser.id);
    expect(firstLogin.account.firstName).toBe("First tenant");
    expect(secondLogin.account.id).toBe(secondTenantUser.id);
    expect(secondLogin.account.firstName).toBe("Second tenant");

    const firstCurrentUser = await request(app.getHttpServer())
      .get("/api/auth/current-user")
      .set("Referer", "https://tenant.local/")
      .set("Cookie", firstLogin.cookies)
      .expect(200);
    const secondCurrentUser = await request(app.getHttpServer())
      .get("/api/auth/current-user")
      .set("Referer", `${secondTenantHost}/`)
      .set("Cookie", secondLogin.cookies)
      .expect(200);

    expect(firstCurrentUser.body.data.id).toBe(firstTenantUser.id);
    expect(secondCurrentUser.body.data.id).toBe(secondTenantUser.id);
  });
});
