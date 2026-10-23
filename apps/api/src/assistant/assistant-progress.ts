import { ASSISTANT_RUN_ACTIVITIES, type AssistantRunActivity } from "@repo/shared";

const searchTools = new Set([
  "global_search",
  "search_lessons",
  "list_courses",
  "list_categories",
  "list_course_categories",
  "list_development_paths",
  "list_qa_entries",
  "list_article_sections",
  "list_articles",
  "list_news",
  "list_users",
  "list_groups",
]);
const readTools = new Set([
  "get_my_capabilities",
  "get_course",
  "get_course_settings",
  "list_course_languages",
  "list_course_group_deadlines",
  "list_chapters",
  "get_chapter",
  "list_lessons",
  "get_lesson",
  "list_lesson_resources",
  "get_category",
  "get_development_path",
  "list_development_path_courses",
  "get_qa_entry",
  "get_article_section",
  "get_article",
  "get_news",
  "get_my_user",
  "get_my_user_details",
  "get_user",
  "get_user_details",
  "list_user_roles",
  "get_group",
  "list_user_groups",
  "list_course_groups",
]);

/** Classifies only explicit supported read operations, never user arguments or message text. */
export function getAssistantReadActivity(name: string): AssistantRunActivity | null {
  if (searchTools.has(name)) return ASSISTANT_RUN_ACTIVITIES.SEARCHING;
  if (readTools.has(name)) return ASSISTANT_RUN_ACTIVITIES.READING;
  return null;
}
