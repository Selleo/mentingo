import { COURSE_ENROLLMENT, COURSE_STATUSES, LESSON_TYPES, PERMISSIONS } from "@repo/shared";
import { PgDialect } from "drizzle-orm/pg-core";

import { LocalizationService } from "src/localization/localization.service";

import { McpStudentLessonRepository } from "./mcp-student-lesson.repository";

import type { McpStudentLessonRow } from "./mcp-student-lesson.types";
import type { SQL } from "drizzle-orm";
import type { CurrentUserType } from "src/common/types/current-user.type";

const user: CurrentUserType = {
  userId: "00000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000002",
  email: "learner@example.com",
  roleSlugs: ["admin"],
  permissions: [PERMISSIONS.COURSE_READ, PERMISSIONS.COURSE_READ_ASSIGNED],
};
const courseId = "00000000-0000-4000-8000-000000000003";
const dialect = new PgDialect();

function setup(lessonRows: McpStudentLessonRow[] = []) {
  const queries: Array<{
    selection: Record<string, unknown>;
    where: jest.Mock;
    limit: jest.Mock;
    offset: jest.Mock;
  }> = [];
  const db = {
    select: jest.fn((selection) => {
      const chain = {
        selection,
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => {
          const offset = chain.offset.mock.calls.at(-1)?.[0] ?? 0;
          const limit = chain.limit.mock.calls.at(-1)?.[0] ?? lessonRows.length;
          const rows =
            "totalItems" in selection
              ? [{ totalItems: 7 }]
              : lessonRows.slice(offset, offset + limit);
          return Promise.resolve(rows).then(resolve);
        },
      };
      queries.push(chain);
      return chain;
    }),
  };
  const repository = new McpStudentLessonRepository(
    db as never,
    new LocalizationService(db as never),
  );
  const where = (index = 0) => dialect.sqlToQuery(queries[index].where.mock.calls[0][0]);
  return { db, queries, repository, where };
}

describe("MCP learner curriculum SQL authorization", () => {
  it("scopes public and own active enrollment access to the connected tenant", async () => {
    const { repository, where } = setup();
    await repository.listLessons({ language: "en" }, user);
    const query = where();
    for (const table of ["courses", "chapters", "lessons", "student_courses"]) {
      expect(query.sql).toContain(`"${table}"."tenant_id"`);
    }
    expect(query.sql).toContain('"courses"."is_archived" =');
    expect(query.sql).toContain('"student_courses"."course_id" = "courses"."id"');
    expect(query.sql).toContain('"student_courses"."student_id" =');
    expect(query.sql).toContain('"student_courses"."status" =');
    expect(query.params.filter((value) => value === user.tenantId)).toHaveLength(4);
    expect(query.params).toContain(user.userId);
    expect(query.params).toContain(COURSE_ENROLLMENT.ENROLLED);
    expect(query.params).toContain(COURSE_STATUSES.PUBLISHED);
    expect(query.params).toContain(COURSE_STATUSES.PRIVATE);
    expect(query.params).not.toContain(COURSE_STATUSES.DRAFT);
    expect(query.params).toContain(false);
  });

  it("does not let admin, author or manager permissions bypass learner access", async () => {
    const { repository, where } = setup();
    await repository.listLessons(
      { language: "en" },
      {
        ...user,
        permissions: [
          PERMISSIONS.COURSE_UPDATE,
          PERMISSIONS.COURSE_UPDATE_OWN,
          PERMISSIONS.USER_MANAGE,
        ],
      },
    );
    expect(where().sql).toContain("(FALSE or FALSE)");
    expect(where().sql).not.toContain("author_id");
    expect(where().sql).not.toContain("EXISTS");
  });

  it("catalog permission alone cannot read private courses or other users' enrollment", async () => {
    const { repository, where } = setup();
    await repository.listLessons(
      { language: "en" },
      { ...user, permissions: [PERMISSIONS.COURSE_READ] },
    );
    expect(where().params).toContain(COURSE_STATUSES.PUBLISHED);
    expect(where().params).not.toContain(COURSE_STATUSES.PRIVATE);
    expect(where().sql).not.toContain("EXISTS");
  });

  it("assigned-only access always requires the connected user's active enrollment", async () => {
    const { repository, where } = setup();
    await repository.listLessons(
      { language: "en" },
      { ...user, permissions: [PERMISSIONS.COURSE_READ_ASSIGNED] },
    );
    expect(where().sql).toContain("FALSE or");
    expect(where().params).toContain(user.userId);
    expect(where().params).toContain(COURSE_ENROLLMENT.ENROLLED);
  });

  it("applies identical authorization to ordinary data and pagination count", async () => {
    const { repository, where, queries } = setup();
    const result = await repository.listLessons(
      {
        courseId,
        chapterId: user.userId,
        lessonId: user.tenantId,
        language: "pl",
        page: 2,
        pageSize: 999,
      },
      user,
    );
    expect(where(0)).toEqual(where(1));
    expect(where().params).toContain(courseId);
    expect(queries[0].limit).toHaveBeenCalledWith(25);
    expect(queries[0].offset).toHaveBeenCalledWith(25);
    expect(result.pagination).toEqual({ page: 2, perPage: 25, totalItems: 7 });
  });

  it("searches sanitized authorized batches with literal matching and counts every match before paging", async () => {
    const rows = Array.from({ length: 102 }, (_, index) => lessonRow(index));
    rows[0].title = "Literal 50%_\\done in title";
    rows[100].description = "<p>literal 50%_\\DONE in authored text</p>";
    rows[101].description = "Third literal 50%_\\done";
    rows[50].description = "50 wildcard done";
    const { repository, queries, where } = setup(rows);
    const result = await repository.listLessons(
      { language: "en", query: "50%_\\done", page: 2, pageSize: 1 },
      user,
    );
    expect(result.data.map((row) => row.id)).toEqual([rows[100].id]);
    expect(result.pagination).toEqual({ page: 2, perPage: 1, totalItems: 3 });
    expect(queries).toHaveLength(2);
    expect(queries[0].limit).toHaveBeenCalledWith(100);
    expect(queries[0].offset).toHaveBeenCalledWith(0);
    expect(queries[1].offset).toHaveBeenCalledWith(100);
    expect(where(0)).toEqual(where(1));
    expect(where().sql).toContain('"lessons"."tenant_id"');
    expect(where().sql).not.toContain("ILIKE");
    expect(where().params).not.toContain("50%_\\done");
  });

  it.each(["hiddenattribute", "unclosedscript", "closedscript", "quizsecret", "hiddentitle"])(
    "does not reveal lessons or counts when %s exists only in discarded content",
    async (query) => {
      const content = lessonRow(0);
      content.title = '<img alt="greater > hiddentitle">';
      content.description =
        '<p>Visible learner body</p><img alt="greater > hiddenattribute"><script>closedscript</script><script>unclosedscript';
      const quiz = lessonRow(1);
      quiz.type = LESSON_TYPES.QUIZ;
      quiz.description = "quizsecret";
      const { repository } = setup([content, quiz]);
      const result = await repository.listLessons({ language: "en", query }, user);
      expect(result.data).toEqual([]);
      expect(result.pagination.totalItems).toBe(0);
    },
  );

  it("projects only learner fields and never non-content descriptions or assessment data", async () => {
    const { repository, queries } = setup();
    await repository.listLessons({ language: "en" }, user);
    expect(Object.keys(queries[0].selection).sort()).toEqual([
      "chapterId",
      "chapterTitle",
      "courseId",
      "courseTitle",
      "description",
      "displayOrder",
      "id",
      "title",
      "type",
    ]);
    const content = dialect.sqlToQuery(queries[0].selection.description as SQL);
    expect(content.sql).toContain('CASE WHEN "lessons"."type" =');
    expect(content.sql).toContain("ELSE NULL END");
    expect(content.params).toContain("content");
  });

  it("uses course access for chapters and returns no identifying result when denied", async () => {
    const { repository, where } = setup();
    expect(await repository.listChapters(courseId, "en", { ...user, permissions: [] })).toEqual([]);
    expect(where().params).toContain(courseId);
    expect(where().params.filter((value) => value === user.tenantId)).toHaveLength(2);
    expect(where().sql).toContain("(FALSE or FALSE)");
  });
});

function lessonRow(index: number): McpStudentLessonRow {
  return {
    id: `lesson-${index}`,
    title: `Lesson ${index}`,
    type: LESSON_TYPES.CONTENT,
    description: "<p>Ordinary learner content</p>",
    displayOrder: index,
    chapterId: "chapter",
    chapterTitle: "Chapter",
    courseId,
    courseTitle: "Course",
  };
}
