import { PERMISSIONS, type PermissionKey, type AssistantSourceType } from "@repo/shared";

import type { CurrentUserType } from "src/common/types/current-user.type";

type Row = Record<string, unknown>;
type LinkContext = {
  origin: string;
  arguments: Row;
  user: CurrentUserType;
  learner: boolean;
};
const entities: Record<string, AssistantSourceType> = {
  allCourses: "course",
  myCourses: "course",
  availableCourses: "course",
  courses: "course",
  course: "course",
  lessons: "lesson",
  lesson: "lesson",
  users: "user",
  groups: "group",
  categories: "category",
  articles: "article",
  article: "article",
  news: "news",
  qa: "qa",
  entries: "qa",
  paths: "development_path",
  learningPaths: "development_path",
  resources: "resource",
  lessonResources: "resource",
};
const tools: Record<string, AssistantSourceType> = {
  list_courses: "course",
  get_course: "course",
  list_lessons: "lesson",
  get_lesson: "lesson",
  search_lessons: "lesson",
  list_users: "user",
  get_user: "user",
  get_user_details: "user",
  get_my_user: "user",
  get_my_user_details: "user",
  list_groups: "group",
  get_group: "group",
  list_user_groups: "group",
  list_course_groups: "group",
  list_categories: "category",
  get_category: "category",
  list_course_categories: "category",
  list_articles: "article",
  get_article: "article",
  list_news: "news",
  get_news: "news",
  list_qa_entries: "qa",
  get_qa_entry: "qa",
  list_development_paths: "development_path",
  get_development_path: "development_path",
  list_development_path_courses: "course",
  list_lesson_resources: "resource",
};

/** Add destinations only after the shared runner has authorized and returned the entity. OAuth never calls this adapter. */
export function linkNativeReadResult(name: string, result: Row, context: LinkContext): Row {
  const origin = new URL(context.origin).origin;
  const can = (...permissions: PermissionKey[]) =>
    permissions.some((permission) => context.user.permissions.includes(permission));
  const path = (prefix: string, id: string) => `${origin}/${prefix}/${encodeURIComponent(id)}`;
  const courseEditor = (courseId: string) =>
    can(PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN)
      ? path("admin/beta-courses", courseId)
      : undefined;
  const visit = (value: unknown, kind?: AssistantSourceType, parent: Row = {}): unknown => {
    if (Array.isArray(value)) return value.map((item) => visit(item, kind, parent));
    if (!value || typeof value !== "object") return value;
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      return value;
    const row = value as Row;
    const next = Object.fromEntries(
      Object.entries(row).map(([key, child]) => [
        key,
        visit(child, entities[key] ?? (key === "data" ? kind : undefined), row),
      ]),
    );
    const id = typeof row.id === "string" ? row.id : undefined;
    if (!id || !kind) return next;
    let title: string | undefined;
    if (kind === "user")
      title = [row.firstName, row.lastName]
        .filter((part) => typeof part === "string" && part)
        .join(" ");
    if (typeof row.name === "string") title = row.name;
    if (typeof row.title === "string") title = row.title;
    const courseId = [row.courseId, parent.courseId, context.arguments.courseId].find(
      (value): value is string => typeof value === "string",
    );
    const lessonId = [row.lessonId, parent.lessonId, context.arguments.lessonId].find(
      (value): value is string => typeof value === "string",
    );
    let url: string | undefined;
    switch (kind) {
      case "course":
        url = context.learner || name === "global_search" ? path("course", id) : courseEditor(id);
        break;
      case "lesson":
        if (courseId && (context.learner || name === "global_search"))
          url = `${path("course", courseId)}/lesson/${encodeURIComponent(id)}`;
        else if (courseId) url = courseEditor(courseId);
        break;
      case "resource":
        if (courseId && lessonId && context.learner)
          url = `${path("course", courseId)}/lesson/${encodeURIComponent(lessonId)}`;
        else if (courseId && lessonId) url = courseEditor(courseId);
        break;
      case "user":
        if (name === "get_user_details" || name.startsWith("get_my_")) url = path("profile", id);
        else if (can(PERMISSIONS.USER_MANAGE)) url = path("admin/users", id);
        break;
      case "group":
        url = can(PERMISSIONS.GROUP_MANAGE) ? path("admin/groups", id) : undefined;
        break;
      case "category":
        url = can(PERMISSIONS.CATEGORY_MANAGE) ? path("admin/categories", id) : undefined;
        break;
      case "article":
        url = path("articles", id) + (!context.learner && name !== "global_search" ? "/edit" : "");
        break;
      case "news":
        url = path("news", id) + (!context.learner && name !== "global_search" ? "/edit" : "");
        break;
      case "qa":
        url =
          context.learner || name === "global_search"
            ? `${origin}/qa?${new URLSearchParams({ qaId: id })}`
            : path("qa", id);
        break;
      case "development_path":
        url =
          title && can(PERMISSIONS.LEARNING_PATH_READ, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
            ? `${origin}/development-paths?${new URLSearchParams({ searchQuery: title })}`
            : undefined;
        break;
    }
    // Do not keep search URLs that point at a UI requiring a permission the actor lacks.
    delete next.url;
    if (!url) return next;
    return {
      ...next,
      ...(title ? { title } : {}),
      entityType: kind,
      url,
      ...(courseId ? { courseId } : {}),
      ...(kind === "resource" && lessonId ? { lessonId } : {}),
    };
  };
  return visit(result, tools[name]) as Row;
}
