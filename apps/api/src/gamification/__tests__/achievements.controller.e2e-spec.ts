import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq, inArray } from "drizzle-orm";
import request from "supertest";

import { FileService } from "src/file/file.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { userAchievements, userStatistics } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const fullTranslations = (suffix = "") => ({
  en: { name: `Badge${suffix}`, description: `Badge description${suffix}` },
  pl: { name: `Odznaka${suffix}`, description: `Opis odznaki${suffix}` },
  de: { name: `Abzeichen${suffix}`, description: `Abzeichenbeschreibung${suffix}` },
  lt: { name: `Ženklelis${suffix}`, description: `Ženklelio aprašymas${suffix}` },
  cs: { name: `Odznak${suffix}`, description: `Popis odznaku${suffix}` },
});

describe("AchievementsController gamification retroactive unlocks (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;

  const password = "password123";

  beforeAll(async () => {
    const e2e = await createE2ETest([
      {
        provide: FileService,
        useValue: {
          getFileUrl: jest.fn(async (key: string) => `signed://${key}`),
          uploadFile: jest.fn(),
        },
      },
    ]);

    app = e2e.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
  }, 30000);

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
  });

  it("inserts retroactive user achievement rows when an admin lowers a threshold via API", async () => {
    const admin = await userFactory
      .withCredentials({ password })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    const firstStudent = await userFactory.create({ tenantId: admin.tenantId });
    const secondStudent = await userFactory.create({ tenantId: admin.tenantId });
    const belowThresholdStudent = await userFactory.create({ tenantId: admin.tenantId });

    await db.insert(userStatistics).values([
      { userId: firstStudent.id, tenantId: admin.tenantId, totalPoints: 150 },
      { userId: secondStudent.id, tenantId: admin.tenantId, totalPoints: 125 },
      { userId: belowThresholdStudent.id, tenantId: admin.tenantId, totalPoints: 75 },
    ]);

    const createResponse = await request(app.getHttpServer())
      .post("/api/achievements/admin")
      .set("Cookie", await cookieFor(admin, app))
      .send({
        imageReference: "achievements/retroactive.png",
        pointThreshold: 200,
        translations: fullTranslations(),
      })
      .expect(201);
    const achievementId = createResponse.body.data.id as UUIDType;

    await request(app.getHttpServer())
      .patch(`/api/achievements/admin/${achievementId}`)
      .set("Cookie", await cookieFor(admin, app))
      .send({ pointThreshold: 100 })
      .expect(200);

    const rows = await db
      .select({ userId: userAchievements.userId })
      .from(userAchievements)
      .where(
        and(
          eq(userAchievements.achievementId, achievementId),
          inArray(userAchievements.userId, [
            firstStudent.id,
            secondStudent.id,
            belowThresholdStudent.id,
          ]),
        ),
      );

    expect(rows.map((row) => row.userId).sort()).toEqual(
      [firstStudent.id, secondStudent.id].sort(),
    );
  });
});
