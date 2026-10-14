import { GLOBAL_SEARCH_MODES, GLOBAL_SEARCH_SEMANTIC_STATUSES } from "@repo/shared";

import { shapeMcpSearchResults } from "./mcp-search-results";

import type { McpLinkedSearchResponse } from "./mcp-search-results.types";
import type { GlobalSearchResponse } from "src/global-search/schemas/global-search.schema";

function response(): GlobalSearchResponse {
  return {
    searchMode: GLOBAL_SEARCH_MODES.HYBRID,
    semanticStatus: GLOBAL_SEARCH_SEMANTIC_STATUSES.READY,
    allCourses: [
      {
        id: "all/id?",
        title: "All",
        matchedPassage: "Private course attachment",
        matchedAttachmentFileName: "private.pdf",
      },
    ],
    myCourses: [{ id: "my/id", title: "My" }],
    availableCourses: [{ id: "available/id", title: "Available" }],
    news: [{ id: "news/id", title: "News", matchedPassage: "Allowed news snippet" }],
    articles: [{ id: "article/id", title: "Article", matchedAttachmentFileName: "allowed.pdf" }],
    qa: [{ id: "qa/id?", title: "Q&A", matchedPassage: "Allowed answer" }],
    lessons: [
      { id: "lesson/id", courseId: "my/id", title: "Lesson", matchedPassage: "Lesson body" },
    ],
    learningPaths: [{ id: "path", title: "Develop & learn", courses: [{ id: "my/id" }] }],
    users: [
      {
        id: "user/id",
        email: "private@example.test",
        firstName: "User",
        lastName: "Name",
        groups: [],
      },
    ],
    categories: [{ id: "category/id", title: "Category" }],
    groups: [{ id: "group/id", name: "Group" }],
  };
}

describe("MCP search result presentation", () => {
  const context = { resource: "https://tenant.example/mcp", searchOnly: false };

  it("uses the bound tenant origin and actual web view routes with encoded IDs", () => {
    const results = shapeMcpSearchResults(response(), context) as McpLinkedSearchResponse;
    expect(results.allCourses[0].url).toBe("https://tenant.example/course/all%2Fid%3F");
    expect(results.myCourses[0].url).toBe("https://tenant.example/course/my%2Fid");
    expect(results.availableCourses[0].url).toBe("https://tenant.example/course/available%2Fid");
    expect(results.news[0].url).toBe("https://tenant.example/news/news%2Fid");
    expect(results.articles[0].url).toBe("https://tenant.example/articles/article%2Fid");
    expect(results.qa[0].url).toBe("https://tenant.example/qa?qaId=qa%2Fid%3F");
    expect(results.lessons[0].url).toBe("https://tenant.example/course/my%2Fid/lesson/lesson%2Fid");
    expect(results.learningPaths[0].url).toBe(
      "https://tenant.example/development-paths?searchQuery=Develop+%26+learn",
    );
    expect(results.users[0].url).toBe("https://tenant.example/admin/users/user%2Fid");
    expect(results.categories[0].url).toBe("https://tenant.example/admin/categories/category%2Fid");
    expect(results.groups[0].url).toBe("https://tenant.example/admin/groups/group%2Fid");
  });

  it("projects SEARCH to authorized content groups, excluding lessons, admin data and course passages", () => {
    const source = response();
    const results = shapeMcpSearchResults(source, { ...context, searchOnly: true });
    expect(Object.keys(results).sort()).toEqual(
      [
        "allCourses",
        "myCourses",
        "availableCourses",
        "news",
        "articles",
        "qa",
        "searchMode",
        "semanticStatus",
      ].sort(),
    );
    expect(results.searchMode).toBe(GLOBAL_SEARCH_MODES.HYBRID);
    expect(results.semanticStatus).toBe(GLOBAL_SEARCH_SEMANTIC_STATUSES.READY);
    expect(results.allCourses[0]).not.toHaveProperty("matchedPassage");
    expect(results.allCourses[0]).not.toHaveProperty("matchedAttachmentFileName");
    expect(results.news[0].matchedPassage).toBe("Allowed news snippet");
    expect(results.articles[0].matchedAttachmentFileName).toBe("allowed.pdf");
    expect(JSON.stringify(results)).not.toContain("private@example.test");
    expect(JSON.stringify(results)).not.toContain("Lesson body");
    expect(JSON.stringify(results)).not.toContain("/admin/");
    expect(JSON.stringify(results)).not.toContain("Private course attachment");
    expect(source.allCourses[0].matchedPassage).toBe("Private course attachment");
    expect(source.lessons).toHaveLength(1);
  });

  it("never forwards arbitrary added service fields or result-supplied URL overrides in SEARCH", () => {
    const source = response();
    Object.assign(source, { futureAdminData: { email: "secret@example.test" } });
    Object.assign(source.allCourses[0], {
      url: "https://attacker.example",
      lessonContent: "Secret",
    });
    Object.assign(source.news[0], { fileDownloadUrl: "https://private.example/file" });
    const results = shapeMcpSearchResults(source, { ...context, searchOnly: true });
    expect(results).not.toHaveProperty("futureAdminData");
    expect(results.allCourses[0]).not.toHaveProperty("lessonContent");
    expect(results.allCourses[0].url).toBe("https://tenant.example/course/all%2Fid%3F");
    expect(results.news[0]).not.toHaveProperty("fileDownloadUrl");
  });

  it("preserves authoring search data and keyword fallback status without rewriting source", () => {
    const source = response();
    source.semanticStatus = GLOBAL_SEARCH_SEMANTIC_STATUSES.UNAVAILABLE;
    const results = shapeMcpSearchResults(source, context) as McpLinkedSearchResponse;
    expect(results.semanticStatus).toBe(GLOBAL_SEARCH_SEMANTIC_STATUSES.UNAVAILABLE);
    expect(results.users[0].email).toBe("private@example.test");
    expect(results.lessons[0].matchedPassage).toBe("Lesson body");
    expect(source.users[0]).not.toHaveProperty("url");
  });

  it.each(["file:///mcp", "javascript:alert(1)", "https://user:secret@tenant.example/mcp"])(
    "rejects a non-HTTP or credential-bearing bound resource %s",
    (resource) =>
      expect(() => shapeMcpSearchResults(response(), { ...context, resource })).toThrow(),
  );
});
