import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../test/create-e2e-test";
import { createSettingsFactory } from "../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("TodoTasksController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let globalSettingsFactory: ReturnType<typeof createSettingsFactory>;
  let user: UserWithCredentials;
  let cookies: string;

  beforeAll(async () => {
    const testContext = await createE2ETest();

    app = testContext.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    globalSettingsFactory = createSettingsFactory(db, null);
  });

  beforeEach(async () => {
    await truncateTables(baseDb, ["todo_tasks", "settings"]);
    await globalSettingsFactory.create({ userId: null });

    user = await userFactory
      .withCredentials({ password: "Password123@@" })
      .withUserSettings(db)
      .create();
    cookies = await cookieFor(user, app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    await request(app.getHttpServer()).get("/api/todo-tasks").expect(401);
  });

  it("supports creating, completing, reordering, and deleting the user's tasks", async () => {
    const first = await request(app.getHttpServer())
      .post("/api/todo-tasks")
      .set("Cookie", cookies)
      .send({ title: "  First task  " })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post("/api/todo-tasks")
      .set("Cookie", cookies)
      .send({ title: "Second task" })
      .expect(201);

    expect(first.body.data).toMatchObject({ title: "First task", completed: false, position: 0 });
    expect(second.body.data).toMatchObject({ title: "Second task", completed: false, position: 1 });

    const completed = await request(app.getHttpServer())
      .patch(`/api/todo-tasks/${first.body.data.id}`)
      .set("Cookie", cookies)
      .send({ completed: true })
      .expect(200);

    expect(completed.body.data).toMatchObject({ completed: true, position: 0 });

    const listed = await request(app.getHttpServer())
      .get("/api/todo-tasks")
      .set("Cookie", cookies)
      .expect(200);

    expect(listed.body.data.map((task: { id: string }) => task.id)).toEqual([
      second.body.data.id,
      first.body.data.id,
    ]);

    await request(app.getHttpServer())
      .put("/api/todo-tasks/order")
      .set("Cookie", cookies)
      .send({ activeTaskIds: [], completedTaskIds: [first.body.data.id] })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/todo-tasks/${second.body.data.id}`)
      .set("Cookie", cookies)
      .expect(200);

    const remaining = await request(app.getHttpServer())
      .get("/api/todo-tasks")
      .set("Cookie", cookies)
      .expect(200);

    expect(remaining.body.data).toHaveLength(1);
    expect(remaining.body.data[0]).toMatchObject({ id: first.body.data.id, completed: true });
  });
});
