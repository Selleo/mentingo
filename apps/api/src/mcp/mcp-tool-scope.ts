import { MCP_REQUESTABLE_SCOPES, MCP_SCOPES } from "@repo/shared";

export { MCP_REQUESTABLE_SCOPES, MCP_SCOPES };

export type McpScope = (typeof MCP_SCOPES)[keyof typeof MCP_SCOPES];

const studentTools = new Set([
  "global_search",
  "list_student_courses",
  "get_student_course",
  "list_student_articles",
  "get_student_article",
  "list_student_news",
  "get_student_news",
  "list_student_qa_entries",
  "get_student_qa_entry",
]);

/** Explicit catalog: a newly registered tool never inherits legacy authoring access. */
const toolScopes: Record<string, McpScope> = {
  list_courses: MCP_SCOPES.COURSES_READ,
  get_course: MCP_SCOPES.COURSES_READ,
  get_course_settings: MCP_SCOPES.COURSES_READ,
  list_course_group_deadlines: MCP_SCOPES.COURSES_READ,
  list_course_languages: MCP_SCOPES.COURSES_READ,
  list_chapters: MCP_SCOPES.COURSES_READ,
  get_chapter: MCP_SCOPES.COURSES_READ,
  list_lessons: MCP_SCOPES.COURSES_READ,
  get_lesson: MCP_SCOPES.COURSES_READ,
  list_lesson_resources: MCP_SCOPES.COURSES_READ,
  set_course_group_deadline: MCP_SCOPES.COURSES_WRITE,
  set_course_status: MCP_SCOPES.COURSES_WRITE,
  delete_course: MCP_SCOPES.COURSES_WRITE,
  set_course_certificate_enabled: MCP_SCOPES.COURSES_WRITE,
  set_course_pricing: MCP_SCOPES.COURSES_WRITE,
  update_course_media: MCP_SCOPES.COURSES_WRITE,
  create_scorm_course: MCP_SCOPES.COURSES_WRITE,
  create_scorm_lesson: MCP_SCOPES.COURSES_WRITE,
  update_scorm_lesson: MCP_SCOPES.COURSES_WRITE,
  create_course: MCP_SCOPES.COURSES_WRITE,
  update_course: MCP_SCOPES.COURSES_WRITE,
  update_course_settings: MCP_SCOPES.COURSES_WRITE,
  add_course_language: MCP_SCOPES.COURSES_WRITE,
  remove_course_language: MCP_SCOPES.COURSES_WRITE,
  create_chapter: MCP_SCOPES.COURSES_WRITE,
  update_chapter: MCP_SCOPES.COURSES_WRITE,
  reorder_chapter: MCP_SCOPES.COURSES_WRITE,
  delete_chapter: MCP_SCOPES.COURSES_WRITE,
  create_content_lesson: MCP_SCOPES.COURSES_WRITE,
  update_content_lesson: MCP_SCOPES.COURSES_WRITE,
  delete_content_lesson: MCP_SCOPES.COURSES_WRITE,
  create_quiz_lesson: MCP_SCOPES.COURSES_WRITE,
  update_quiz_lesson: MCP_SCOPES.COURSES_WRITE,
  create_ai_mentor_lesson: MCP_SCOPES.COURSES_WRITE,
  update_ai_mentor_lesson: MCP_SCOPES.COURSES_WRITE,
  create_embed_lesson: MCP_SCOPES.COURSES_WRITE,
  update_embed_lesson: MCP_SCOPES.COURSES_WRITE,
  create_live_training_lesson: MCP_SCOPES.COURSES_WRITE,
  update_live_training_lesson: MCP_SCOPES.COURSES_WRITE,
  reorder_lesson: MCP_SCOPES.COURSES_WRITE,
  delete_lesson: MCP_SCOPES.COURSES_WRITE,
  insert_lesson_resource: MCP_SCOPES.COURSES_WRITE,
  remove_lesson_resource: MCP_SCOPES.COURSES_WRITE,
  request_authoring_upload: MCP_SCOPES.FILES_WRITE,
  request_course_upload: MCP_SCOPES.FILES_WRITE,
  request_development_path_upload: MCP_SCOPES.FILES_WRITE,
  request_editorial_cover_upload: MCP_SCOPES.FILES_WRITE,
  request_ai_mentor_avatar_upload: MCP_SCOPES.FILES_WRITE,
  init_video_upload: MCP_SCOPES.FILES_WRITE,
  get_video_upload_status: MCP_SCOPES.FILES_WRITE,
  request_my_avatar_upload: MCP_SCOPES.FILES_WRITE,
  request_platform_image_upload: MCP_SCOPES.FILES_WRITE,
  request_platform_login_document_upload: MCP_SCOPES.FILES_WRITE,
  request_generic_file_upload: MCP_SCOPES.FILES_WRITE,
  list_course_categories: MCP_SCOPES.CATEGORIES_READ,
  list_categories: MCP_SCOPES.CATEGORIES_READ,
  get_category: MCP_SCOPES.CATEGORIES_READ,
  create_category: MCP_SCOPES.CATEGORIES_WRITE,
  update_category: MCP_SCOPES.CATEGORIES_WRITE,
  add_category_language: MCP_SCOPES.CATEGORIES_WRITE,
  remove_category_language: MCP_SCOPES.CATEGORIES_WRITE,
  set_category_base_language: MCP_SCOPES.CATEGORIES_WRITE,
  delete_category: MCP_SCOPES.CATEGORIES_WRITE,
  list_qa_entries: MCP_SCOPES.QA_READ,
  get_qa_entry: MCP_SCOPES.QA_READ,
  create_qa_entry: MCP_SCOPES.QA_WRITE,
  update_qa_entry: MCP_SCOPES.QA_WRITE,
  add_qa_language: MCP_SCOPES.QA_WRITE,
  remove_qa_language: MCP_SCOPES.QA_WRITE,
  delete_qa_entry: MCP_SCOPES.QA_WRITE,
  list_article_sections: MCP_SCOPES.ARTICLES_READ,
  get_article_section: MCP_SCOPES.ARTICLES_READ,
  get_article: MCP_SCOPES.ARTICLES_READ,
  list_articles: MCP_SCOPES.ARTICLES_READ,
  create_article_section: MCP_SCOPES.ARTICLES_WRITE,
  update_article_section: MCP_SCOPES.ARTICLES_WRITE,
  add_article_section_language: MCP_SCOPES.ARTICLES_WRITE,
  remove_article_section_language: MCP_SCOPES.ARTICLES_WRITE,
  delete_article_section: MCP_SCOPES.ARTICLES_WRITE,
  create_article: MCP_SCOPES.ARTICLES_WRITE,
  update_article: MCP_SCOPES.ARTICLES_WRITE,
  add_article_language: MCP_SCOPES.ARTICLES_WRITE,
  remove_article_language: MCP_SCOPES.ARTICLES_WRITE,
  delete_article: MCP_SCOPES.ARTICLES_WRITE,
  list_news: MCP_SCOPES.NEWS_READ,
  get_news: MCP_SCOPES.NEWS_READ,
  create_news: MCP_SCOPES.NEWS_WRITE,
  update_news: MCP_SCOPES.NEWS_WRITE,
  set_news_status: MCP_SCOPES.NEWS_WRITE,
  add_news_language: MCP_SCOPES.NEWS_WRITE,
  remove_news_language: MCP_SCOPES.NEWS_WRITE,
  delete_news: MCP_SCOPES.NEWS_WRITE,
  list_development_paths: MCP_SCOPES.LEARNING_PATHS_READ,
  get_development_path: MCP_SCOPES.LEARNING_PATHS_READ,
  list_development_path_courses: MCP_SCOPES.LEARNING_PATHS_READ,
  create_development_path: MCP_SCOPES.LEARNING_PATHS_WRITE,
  update_development_path: MCP_SCOPES.LEARNING_PATHS_WRITE,
  set_development_path_status: MCP_SCOPES.LEARNING_PATHS_WRITE,
  add_development_path_language: MCP_SCOPES.LEARNING_PATHS_WRITE,
  add_courses_to_development_path: MCP_SCOPES.LEARNING_PATHS_WRITE,
  reorder_development_path_courses: MCP_SCOPES.LEARNING_PATHS_WRITE,
  remove_course_from_development_path: MCP_SCOPES.LEARNING_PATHS_WRITE,
  delete_development_path: MCP_SCOPES.LEARNING_PATHS_WRITE,
  get_my_user: MCP_SCOPES.USERS_READ,
  get_my_user_details: MCP_SCOPES.USERS_READ,
  list_users: MCP_SCOPES.USERS_READ,
  get_user: MCP_SCOPES.USERS_READ,
  get_user_details: MCP_SCOPES.USERS_READ,
  list_user_roles: MCP_SCOPES.USERS_READ,
  update_my_user: MCP_SCOPES.USERS_WRITE,
  remove_my_avatar: MCP_SCOPES.USERS_WRITE,
  update_user: MCP_SCOPES.USERS_WRITE,
  update_users_roles: MCP_SCOPES.USERS_WRITE,
  assign_users_groups: MCP_SCOPES.USERS_WRITE,
  update_my_profile: MCP_SCOPES.USERS_WRITE,
  update_my_details: MCP_SCOPES.USERS_WRITE,
  list_groups: MCP_SCOPES.GROUPS_READ,
  get_group: MCP_SCOPES.GROUPS_READ,
  list_user_groups: MCP_SCOPES.GROUPS_READ,
  list_course_groups: MCP_SCOPES.GROUPS_READ,
  create_group: MCP_SCOPES.GROUPS_WRITE,
  update_group: MCP_SCOPES.GROUPS_WRITE,
  add_group_language: MCP_SCOPES.GROUPS_WRITE,
  remove_group_language: MCP_SCOPES.GROUPS_WRITE,
  set_group_base_language: MCP_SCOPES.GROUPS_WRITE,
  set_user_groups: MCP_SCOPES.GROUPS_WRITE,
  get_platform_customization: MCP_SCOPES.PLATFORM_READ,
  get_platform_registration_form: MCP_SCOPES.PLATFORM_READ,
  list_platform_login_documents: MCP_SCOPES.PLATFORM_READ,
  update_platform_colors: MCP_SCOPES.PLATFORM_WRITE,
  update_platform_company_information: MCP_SCOPES.PLATFORM_WRITE,
  update_platform_registration_form: MCP_SCOPES.PLATFORM_WRITE,
  toggle_platform_customization_flag: MCP_SCOPES.PLATFORM_WRITE,
  update_platform_default_currency: MCP_SCOPES.PLATFORM_WRITE,
  update_platform_age_limit: MCP_SCOPES.PLATFORM_WRITE,
  update_platform_featured_course: MCP_SCOPES.PLATFORM_WRITE,
  update_platform_live_training_capacity: MCP_SCOPES.PLATFORM_WRITE,
  remove_platform_image: MCP_SCOPES.PLATFORM_WRITE,
  delete_platform_login_document: MCP_SCOPES.PLATFORM_WRITE,
  global_search: MCP_SCOPES.SEARCH_READ,
};

export function isRequestableMcpScopeSet(scopes: unknown): scopes is McpScope[] {
  if (!Array.isArray(scopes) || scopes.length === 0 || new Set(scopes).size !== scopes.length)
    return false;
  if (!scopes.every((scope) => MCP_REQUESTABLE_SCOPES.includes(scope))) return false;
  return !scopes.includes(MCP_SCOPES.STUDENT_READ) || scopes.length === 1;
}

/** Legacy grants remain valid until reconnection but cannot be mixed with new scopes. */
export function isMcpScopeSet(scopes: unknown): scopes is McpScope[] {
  if (isRequestableMcpScopeSet(scopes)) return true;
  return (
    Array.isArray(scopes) &&
    scopes.length === 1 &&
    (scopes[0] === MCP_SCOPES.AUTHORING || scopes[0] === MCP_SCOPES.SEARCH)
  );
}

export function parseMcpScopes(value: unknown): string[] {
  return typeof value === "string" ? value.split(" ") : [];
}

export function areMcpScopeSetsEqual(left: unknown, right: unknown): boolean {
  return (
    isMcpScopeSet(left) &&
    isMcpScopeSet(right) &&
    left.length === right.length &&
    left.every((scope) => right.includes(scope))
  );
}

export function canUseMcpToolWithScopes(name: string, scopes: unknown): boolean {
  if (!isMcpScopeSet(scopes)) return false;
  if (scopes.includes(MCP_SCOPES.STUDENT_READ)) return studentTools.has(name);
  if (scopes[0] === MCP_SCOPES.SEARCH) return name === "global_search";
  if (name === "get_my_capabilities")
    return scopes.some((scope) => scope !== MCP_SCOPES.SEARCH_READ);
  if (!Object.prototype.hasOwnProperty.call(toolScopes, name)) return false;
  if (scopes[0] === MCP_SCOPES.AUTHORING) return true;
  return scopes.includes(toolScopes[name]);
}
