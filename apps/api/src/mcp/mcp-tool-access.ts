import {
  FEATURES,
  FEATURE_SETTINGS_KEYS,
  PERMISSIONS,
  hasAnyPermission,
  type PermissionKey,
} from "@repo/shared";

import type { SettingsService } from "src/settings/settings.service";

type Settings = Awaited<ReturnType<SettingsService["getGlobalSettings"]>>;

export const MCP_CAPABILITIES = {
  SELF: "self",
  COURSE_READ: "course_read",
  COURSE_ENROLLMENT: "course_enrollment",
  CATEGORY_MANAGE: "category_manage",
  COURSE_CREATE: "course_create",
  COURSE_DELETE: "course_delete",
  FILE_UPLOAD: "file_upload",
  AUTHORING_UPLOAD: "authoring_upload",
  LIVE_TRAINING: "live_training",
  PATH_CREATE: "path_create",
  PATH_DELETE: "path_delete",
  PATH_COURSES: "path_courses",
  COURSE_UPDATE: "course_update",
  PATH_UPDATE: "path_update",
  QA_MANAGE: "qa_manage",
  ARTICLE_MANAGE: "article_manage",
  NEWS_MANAGE: "news_manage",
} as const;

export type McpCapability = (typeof MCP_CAPABILITIES)[keyof typeof MCP_CAPABILITIES];

export function capabilityForMcpTool(name: string): McpCapability | null {
  switch (name) {
    case "get_my_capabilities":
      return MCP_CAPABILITIES.SELF;
    case "list_courses":
      return MCP_CAPABILITIES.COURSE_READ;
    case "list_course_group_deadlines":
    case "set_course_group_deadline":
      return MCP_CAPABILITIES.COURSE_ENROLLMENT;
    case "list_categories":
    case "get_category":
    case "create_category":
    case "update_category":
    case "add_category_language":
    case "remove_category_language":
    case "set_category_base_language":
    case "delete_category":
      return MCP_CAPABILITIES.CATEGORY_MANAGE;
    case "list_course_categories":
    case "create_course":
    case "create_scorm_course":
      return MCP_CAPABILITIES.COURSE_CREATE;
    case "delete_course":
      return MCP_CAPABILITIES.COURSE_DELETE;
    case "request_generic_file_upload":
      return MCP_CAPABILITIES.FILE_UPLOAD;
    case "request_authoring_upload":
    case "request_editorial_cover_upload":
    case "init_video_upload":
    case "get_video_upload_status":
      return MCP_CAPABILITIES.AUTHORING_UPLOAD;
    case "create_live_training_lesson":
    case "update_live_training_lesson":
      return MCP_CAPABILITIES.LIVE_TRAINING;
    case "create_development_path":
      return MCP_CAPABILITIES.PATH_CREATE;
    case "delete_development_path":
      return MCP_CAPABILITIES.PATH_DELETE;
    case "list_development_path_courses":
    case "add_courses_to_development_path":
    case "reorder_development_path_courses":
    case "remove_course_from_development_path":
      return MCP_CAPABILITIES.PATH_COURSES;
    case "get_course":
    case "get_course_settings":
    case "list_course_languages":
    case "set_course_status":
    case "set_course_certificate_enabled":
    case "set_course_pricing":
    case "update_course_media":
    case "list_chapters":
    case "get_chapter":
    case "request_course_upload":
    case "request_ai_mentor_avatar_upload":
    case "create_scorm_lesson":
    case "update_scorm_lesson":
    case "update_course":
    case "update_course_settings":
    case "add_course_language":
    case "remove_course_language":
    case "create_chapter":
    case "update_chapter":
    case "reorder_chapter":
    case "delete_chapter":
    case "list_lessons":
    case "get_lesson":
    case "create_content_lesson":
    case "update_content_lesson":
    case "delete_content_lesson":
    case "create_quiz_lesson":
    case "update_quiz_lesson":
    case "create_ai_mentor_lesson":
    case "update_ai_mentor_lesson":
    case "create_embed_lesson":
    case "update_embed_lesson":
    case "reorder_lesson":
    case "delete_lesson":
    case "list_lesson_resources":
    case "insert_lesson_resource":
    case "remove_lesson_resource":
      return MCP_CAPABILITIES.COURSE_UPDATE;
    case "request_development_path_upload":
    case "list_development_paths":
    case "get_development_path":
    case "update_development_path":
    case "set_development_path_status":
    case "add_development_path_language":
      return MCP_CAPABILITIES.PATH_UPDATE;
    case "list_qa_entries":
    case "get_qa_entry":
    case "create_qa_entry":
    case "update_qa_entry":
    case "add_qa_language":
    case "remove_qa_language":
    case "delete_qa_entry":
      return MCP_CAPABILITIES.QA_MANAGE;
    case "list_article_sections":
    case "get_article_section":
    case "create_article_section":
    case "update_article_section":
    case "add_article_section_language":
    case "remove_article_section_language":
    case "delete_article_section":
    case "get_article":
    case "list_articles":
    case "create_article":
    case "update_article":
    case "add_article_language":
    case "remove_article_language":
    case "delete_article":
      return MCP_CAPABILITIES.ARTICLE_MANAGE;
    case "list_news":
    case "get_news":
    case "create_news":
    case "update_news":
    case "set_news_status":
    case "add_news_language":
    case "remove_news_language":
    case "delete_news":
      return MCP_CAPABILITIES.NEWS_MANAGE;
    default:
      return null;
  }
}

export function canListMcpTool(
  name: string,
  permissions: PermissionKey[],
  settings: Settings,
): boolean {
  const capability = capabilityForMcpTool(name);
  switch (capability) {
    case MCP_CAPABILITIES.SELF:
      return true;
    case MCP_CAPABILITIES.COURSE_READ:
      return permissions.includes(PERMISSIONS.COURSE_READ_MANAGEABLE);
    case MCP_CAPABILITIES.COURSE_ENROLLMENT:
      return permissions.includes(PERMISSIONS.COURSE_ENROLLMENT);
    case MCP_CAPABILITIES.CATEGORY_MANAGE:
      return permissions.includes(PERMISSIONS.CATEGORY_MANAGE);
    case MCP_CAPABILITIES.COURSE_CREATE:
      return permissions.includes(PERMISSIONS.COURSE_CREATE);
    case MCP_CAPABILITIES.COURSE_DELETE:
      return permissions.includes(PERMISSIONS.COURSE_DELETE);
    case MCP_CAPABILITIES.FILE_UPLOAD:
      return permissions.includes(PERMISSIONS.FILE_UPLOAD);
    case MCP_CAPABILITIES.AUTHORING_UPLOAD:
      return (
        hasAnyPermission(permissions, [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN]) ||
        (settings[FEATURE_SETTINGS_KEYS[FEATURES.ARTICLES]] &&
          hasAnyPermission(permissions, [
            PERMISSIONS.ARTICLE_MANAGE,
            PERMISSIONS.ARTICLE_MANAGE_OWN,
          ])) ||
        (settings[FEATURE_SETTINGS_KEYS[FEATURES.NEWS]] &&
          hasAnyPermission(permissions, [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN]))
      );
    case MCP_CAPABILITIES.LIVE_TRAINING:
      return (
        settings[FEATURE_SETTINGS_KEYS[FEATURES.LIVE_TRAINING]] &&
        hasAnyPermission(permissions, [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN])
      );
    case MCP_CAPABILITIES.PATH_CREATE:
      return (
        settings.learningPathsEnabled && permissions.includes(PERMISSIONS.LEARNING_PATH_CREATE)
      );
    case MCP_CAPABILITIES.PATH_DELETE:
      return (
        settings.learningPathsEnabled && permissions.includes(PERMISSIONS.LEARNING_PATH_DELETE)
      );
    case MCP_CAPABILITIES.PATH_COURSES:
      return (
        settings.learningPathsEnabled &&
        hasAnyPermission(permissions, [
          PERMISSIONS.LEARNING_PATH_COURSE_UPDATE,
          PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN,
        ])
      );
    case MCP_CAPABILITIES.COURSE_UPDATE:
      return hasAnyPermission(permissions, [
        PERMISSIONS.COURSE_UPDATE,
        PERMISSIONS.COURSE_UPDATE_OWN,
      ]);
    case MCP_CAPABILITIES.PATH_UPDATE:
      return (
        settings.learningPathsEnabled &&
        hasAnyPermission(permissions, [
          PERMISSIONS.LEARNING_PATH_UPDATE,
          PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
        ])
      );
    case MCP_CAPABILITIES.QA_MANAGE:
      return (
        settings[FEATURE_SETTINGS_KEYS[FEATURES.QA]] && permissions.includes(PERMISSIONS.QA_MANAGE)
      );
    case MCP_CAPABILITIES.ARTICLE_MANAGE:
      return (
        settings[FEATURE_SETTINGS_KEYS[FEATURES.ARTICLES]] &&
        hasAnyPermission(permissions, [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN])
      );
    case MCP_CAPABILITIES.NEWS_MANAGE:
      return (
        settings[FEATURE_SETTINGS_KEYS[FEATURES.NEWS]] &&
        hasAnyPermission(permissions, [PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN])
      );
    default:
      return false;
  }
}
