import {
  ASSISTANT_SOURCE_TYPES,
  PERMISSIONS,
  type PermissionKey,
  type AssistantSourceType,
} from "@repo/shared";

import type { CurrentUserType } from "src/common/types/current-user.type";

type Row = Record<string, unknown>;
type LinkContext = {
  origin: string;
  arguments: Row;
  user: CurrentUserType;
  learner: boolean;
};
const entities: Record<string, AssistantSourceType> = {
  allCourses: ASSISTANT_SOURCE_TYPES.COURSE,
  myCourses: ASSISTANT_SOURCE_TYPES.COURSE,
  availableCourses: ASSISTANT_SOURCE_TYPES.COURSE,
  courses: ASSISTANT_SOURCE_TYPES.COURSE,
  course: ASSISTANT_SOURCE_TYPES.COURSE,
  lessons: ASSISTANT_SOURCE_TYPES.LESSON,
  lesson: ASSISTANT_SOURCE_TYPES.LESSON,
  users: ASSISTANT_SOURCE_TYPES.USER,
  groups: ASSISTANT_SOURCE_TYPES.GROUP,
  categories: ASSISTANT_SOURCE_TYPES.CATEGORY,
  articles: ASSISTANT_SOURCE_TYPES.ARTICLE,
  article: ASSISTANT_SOURCE_TYPES.ARTICLE,
  news: ASSISTANT_SOURCE_TYPES.NEWS,
  qa: ASSISTANT_SOURCE_TYPES.QA,
  entries: ASSISTANT_SOURCE_TYPES.QA,
  paths: ASSISTANT_SOURCE_TYPES.DEVELOPMENT_PATH,
  learningPaths: ASSISTANT_SOURCE_TYPES.DEVELOPMENT_PATH,
  resources: ASSISTANT_SOURCE_TYPES.RESOURCE,
  lessonResources: ASSISTANT_SOURCE_TYPES.RESOURCE,
};
const tools: Record<string, AssistantSourceType> = {
  list_courses: ASSISTANT_SOURCE_TYPES.COURSE,
  get_course: ASSISTANT_SOURCE_TYPES.COURSE,
  list_lessons: ASSISTANT_SOURCE_TYPES.LESSON,
  get_lesson: ASSISTANT_SOURCE_TYPES.LESSON,
  search_lessons: ASSISTANT_SOURCE_TYPES.LESSON,
  list_users: ASSISTANT_SOURCE_TYPES.USER,
  get_user: ASSISTANT_SOURCE_TYPES.USER,
  get_user_details: ASSISTANT_SOURCE_TYPES.USER,
  get_my_user: ASSISTANT_SOURCE_TYPES.USER,
  get_my_user_details: ASSISTANT_SOURCE_TYPES.USER,
  list_groups: ASSISTANT_SOURCE_TYPES.GROUP,
  get_group: ASSISTANT_SOURCE_TYPES.GROUP,
  list_user_groups: ASSISTANT_SOURCE_TYPES.GROUP,
  list_course_groups: ASSISTANT_SOURCE_TYPES.GROUP,
  list_categories: ASSISTANT_SOURCE_TYPES.CATEGORY,
  get_category: ASSISTANT_SOURCE_TYPES.CATEGORY,
  list_course_categories: ASSISTANT_SOURCE_TYPES.CATEGORY,
  list_articles: ASSISTANT_SOURCE_TYPES.ARTICLE,
  get_article: ASSISTANT_SOURCE_TYPES.ARTICLE,
  list_news: ASSISTANT_SOURCE_TYPES.NEWS,
  get_news: ASSISTANT_SOURCE_TYPES.NEWS,
  list_qa_entries: ASSISTANT_SOURCE_TYPES.QA,
  get_qa_entry: ASSISTANT_SOURCE_TYPES.QA,
  list_development_paths: ASSISTANT_SOURCE_TYPES.DEVELOPMENT_PATH,
  get_development_path: ASSISTANT_SOURCE_TYPES.DEVELOPMENT_PATH,
  list_development_path_courses: ASSISTANT_SOURCE_TYPES.COURSE,
  list_lesson_resources: ASSISTANT_SOURCE_TYPES.RESOURCE,
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
    if (kind === ASSISTANT_SOURCE_TYPES.USER)
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
      case ASSISTANT_SOURCE_TYPES.COURSE:
        url = context.learner || name === "global_search" ? path("course", id) : courseEditor(id);
        break;
      case ASSISTANT_SOURCE_TYPES.LESSON:
        if (courseId && (context.learner || name === "global_search"))
          url = `${path("course", courseId)}/lesson/${encodeURIComponent(id)}`;
        else if (courseId) url = courseEditor(courseId);
        break;
      case ASSISTANT_SOURCE_TYPES.RESOURCE:
        if (courseId && lessonId && context.learner)
          url = `${path("course", courseId)}/lesson/${encodeURIComponent(lessonId)}`;
        else if (courseId && lessonId) url = courseEditor(courseId);
        break;
      case ASSISTANT_SOURCE_TYPES.USER:
        if (name === "get_user_details" || name.startsWith("get_my_")) url = path("profile", id);
        else if (can(PERMISSIONS.USER_MANAGE)) url = path("admin/users", id);
        break;
      case ASSISTANT_SOURCE_TYPES.GROUP:
        url = can(PERMISSIONS.GROUP_MANAGE) ? path("admin/groups", id) : undefined;
        break;
      case ASSISTANT_SOURCE_TYPES.CATEGORY:
        url = can(PERMISSIONS.CATEGORY_MANAGE) ? path("admin/categories", id) : undefined;
        break;
      case ASSISTANT_SOURCE_TYPES.ARTICLE:
        url = path("articles", id) + (!context.learner && name !== "global_search" ? "/edit" : "");
        break;
      case ASSISTANT_SOURCE_TYPES.NEWS:
        url = path("news", id) + (!context.learner && name !== "global_search" ? "/edit" : "");
        break;
      case ASSISTANT_SOURCE_TYPES.QA:
        url =
          context.learner || name === "global_search"
            ? `${origin}/qa?${new URLSearchParams({ qaId: id })}`
            : path("qa", id);
        break;
      case ASSISTANT_SOURCE_TYPES.DEVELOPMENT_PATH:
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
      ...(kind === ASSISTANT_SOURCE_TYPES.RESOURCE && lessonId ? { lessonId } : {}),
    };
  };
  return visit(result, tools[name]) as Row;
}
