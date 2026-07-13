import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("DashboardController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let student: UserWithCredentials;
  let cookies: string;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);

    student = await createUserFactory(db)
      .withCredentials({ password: "Password123@@" })
      .withUserSettings(db)
      .create();
    cookies = await cookieFor(student, app);
  });

  beforeEach(async () => {
    await truncateTables(baseDb, ["dashboard_layout_widgets", "dashboard_layouts"]);
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the role-aware default layout when no saved layout exists", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/dashboard/layout")
      .set("Cookie", cookies)
      .expect(200);

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ widgetId: "continue-learning", order: 1 }),
        expect.objectContaining({ widgetId: "required-course" }),
      ]),
    );
  });

  it("replaces and returns the saved layout", async () => {
    const widgets = [
      {
        widgetId: "required-course",
        order: 2,
        enabled: true,
        size: "medium",
        settings: {},
      },
      {
        widgetId: "continue-learning",
        order: 1,
        enabled: true,
        size: "large",
        settings: {},
      },
    ];

    const updateResponse = await request(app.getHttpServer())
      .put("/api/dashboard/layout")
      .set("Cookie", cookies)
      .send({ widgets })
      .expect(200);

    expect(updateResponse.body.data.map(({ widgetId }: { widgetId: string }) => widgetId)).toEqual([
      "continue-learning",
      "required-course",
    ]);

    const getResponse = await request(app.getHttpServer())
      .get("/api/dashboard/layout")
      .set("Cookie", cookies)
      .expect(200);

    expect(getResponse.body.data).toEqual(updateResponse.body.data);
  });

  it("rejects duplicate widgets", async () => {
    const widget = {
      widgetId: "continue-learning",
      order: 1,
      enabled: true,
      size: "large",
      settings: {},
    };

    await request(app.getHttpServer())
      .put("/api/dashboard/layout")
      .set("Cookie", cookies)
      .send({ widgets: [widget, widget] })
      .expect(400);
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/api/dashboard/layout").expect(401);
  });
});
