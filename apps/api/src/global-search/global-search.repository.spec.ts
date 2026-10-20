import { COURSE_ENROLLMENT, COURSE_STATUSES, PERMISSIONS } from "@repo/shared";
import { PgDialect } from "drizzle-orm/pg-core";

import { LocalizationService } from "src/localization/localization.service";

import { GlobalSearchRepository } from "./global-search.repository";

import type { CurrentUserType } from "src/common/types/current-user.type";

const actor: CurrentUserType = {
  userId: "00000000-0000-0000-0000-000000000001",
  tenantId: "00000000-0000-0000-0000-000000000002",
  email: "admin@example.test",
  roleSlugs: ["admin"],
  permissions: [
    PERMISSIONS.COURSE_READ,
    PERMISSIONS.COURSE_READ_ASSIGNED,
    PERMISSIONS.COURSE_UPDATE,
  ],
};

function setup() {
  const query = {
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([]),
  };
  const db = { select: jest.fn().mockReturnValue(query) };
  const repository = new GlobalSearchRepository(db as never, new LocalizationService(db as never));
  return { repository, query, db };
}

describe("learner global-search lesson hydration", () => {
  it("rechecks tenant, archive and own enrollment while selecting no attachment data", async () => {
    const { repository, query, db } = setup();
    await repository.getLearnerLessons(
      [{ entityId: actor.userId, languages: ["en"], rank: 1 }],
      "en",
      actor,
    );
    expect(db.select).toHaveBeenCalledTimes(1);
    expect(Object.keys(db.select.mock.calls[0][0]).sort()).toEqual(["courseId", "id", "title"]);
    const built = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
    for (const table of ["courses", "chapters", "lessons", "student_courses"])
      expect(built.sql).toContain(`"${table}"."tenant_id"`);
    expect(built.sql).toContain('"courses"."is_archived"');
    expect(built.sql).toContain('"courses"."price_in_cents" =');
    expect(built.params).toContain(0);
    expect(built.sql).toContain('"student_courses"."student_id"');
    expect(built.sql).not.toContain("author_id");
    expect(built.params).toEqual(
      expect.arrayContaining([
        actor.userId,
        actor.tenantId,
        COURSE_STATUSES.PUBLISHED,
        COURSE_STATUSES.PRIVATE,
        COURSE_ENROLLMENT.ENROLLED,
        false,
      ]),
    );
  });

  it("never grants admin-only access and skips database work for empty matches", async () => {
    const { repository, query, db } = setup();
    expect(await repository.getLearnerLessons([], "en", actor)).toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
    await repository.getLearnerLessons(
      [{ entityId: actor.userId, languages: ["en"], rank: 1 }],
      "en",
      { ...actor, permissions: [PERMISSIONS.COURSE_UPDATE] },
    );
    expect(new PgDialect().sqlToQuery(query.where.mock.calls[0][0]).sql).toContain(
      "(false or false)",
    );
  });
});
