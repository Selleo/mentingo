import { PERMISSIONS } from "@repo/shared";

import { collectAssistantSources } from "src/assistant/assistant-links";

import { linkNativeReadResult } from "./mcp-native-links";

import type { CurrentUserType } from "src/common/types/current-user.type";

describe("Native authorized entity destinations", () => {
  const id = "entity-1";
  const origin = "https://tenant.example";
  const context = {
    origin,
    arguments: { courseId: "course-1", lessonId: "lesson-1" },
    user: { userId: "actor", permissions: Object.values(PERMISSIONS) } as CurrentUserType,
    learner: false,
  };
  it.each([
    ["list_users", "user", "/admin/users/entity-1"],
    ["get_user_details", "user", "/profile/entity-1"],
    ["get_my_user", "user", "/profile/entity-1"],
    ["list_courses", "course", "/admin/beta-courses/entity-1"],
    ["get_lesson", "lesson", "/admin/beta-courses/course-1"],
    ["list_lesson_resources", "resource", "/admin/beta-courses/course-1"],
    ["get_article", "article", "/articles/entity-1/edit"],
    ["get_news", "news", "/news/entity-1/edit"],
    ["get_qa_entry", "qa", "/qa/entity-1"],
    ["get_group", "group", "/admin/groups/entity-1"],
    ["get_category", "category", "/admin/categories/entity-1"],
    ["get_development_path", "development_path", "/development-paths?searchQuery=Fixture"],
  ])("links %s using a real authorized web destination", (name, entityType, destination) => {
    const result = linkNativeReadResult(name, { id, title: "Fixture" }, context);
    expect(result.url).toBe(origin + destination);
    expect(collectAssistantSources(result, origin)).toEqual([
      { title: "Fixture", url: origin + destination, entityType },
    ]);
  });
  it("links actual returned user names without saving email or role preview data", () => {
    const result = linkNativeReadResult(
      "list_users",
      {
        data: [
          {
            id,
            firstName: "Ada",
            lastName: "Nowak",
            email: "private@example.com",
            roles: ["admin"],
            description: "Private profile",
          },
        ],
      },
      context,
    );
    expect(collectAssistantSources(result, origin)).toEqual([
      { title: "Ada Nowak", url: `${origin}/admin/users/${id}`, entityType: "user" },
    ]);
  });
  it("preserves learner links and links nested search entities by their returned identity", () => {
    const result = linkNativeReadResult(
      "global_search",
      {
        users: [{ id, firstName: "Ada", lastName: "Nowak" }],
        lessons: [{ id, title: "Lesson", courseId: "course-1" }],
      },
      context,
    );
    expect(collectAssistantSources(result, origin)).toEqual([
      { title: "Ada Nowak", url: `${origin}/admin/users/${id}`, entityType: "user" },
      { title: "Lesson", url: `${origin}/course/course-1/lesson/${id}`, entityType: "lesson" },
    ]);
    expect(
      linkNativeReadResult(
        "get_article",
        { article: { id, title: "Fixture" } },
        { ...context, learner: true },
      ),
    ).toEqual({ article: expect.objectContaining({ url: `${origin}/articles/${id}` }) });
  });
  it("does not invent admin or file destinations for read-only custom roles", () => {
    const readonly = {
      ...context,
      user: { ...context.user, permissions: [PERMISSIONS.GROUP_READ, PERMISSIONS.CATEGORY_READ] },
    };
    expect(
      linkNativeReadResult(
        "get_group",
        { id, name: "Group", url: `${origin}/admin/groups/${id}` },
        readonly,
      ),
    ).not.toHaveProperty("url");
    expect(
      linkNativeReadResult("get_category", { id, title: "Category" }, readonly),
    ).not.toHaveProperty("url");
    expect(
      collectAssistantSources(
        { id, title: "File", url: `${origin}/api/lesson/lesson-resource/${id}` },
        origin,
      ),
    ).toEqual([]);
  });
});
