/** OAuth scopes narrow account permissions; student access is an exclusive learner projection. */
export const MCP_SCOPES = {
  ACCOUNT_ACCESS: "account:access",
  AUTHORING: "authoring",
  SEARCH: "search",
  STUDENT_READ: "student:read",
  SEARCH_READ: "search:read",
  COURSES_READ: "courses:read",
  COURSES_WRITE: "courses:write",
  CATEGORIES_READ: "categories:read",
  CATEGORIES_WRITE: "categories:write",
  ARTICLES_READ: "articles:read",
  ARTICLES_WRITE: "articles:write",
  NEWS_READ: "news:read",
  NEWS_WRITE: "news:write",
  QA_READ: "qa:read",
  QA_WRITE: "qa:write",
  LEARNING_PATHS_READ: "learning_paths:read",
  LEARNING_PATHS_WRITE: "learning_paths:write",
  USERS_READ: "users:read",
  USERS_WRITE: "users:write",
  GROUPS_READ: "groups:read",
  GROUPS_WRITE: "groups:write",
  PLATFORM_READ: "platform:read",
  PLATFORM_WRITE: "platform:write",
  FILES_WRITE: "files:write",
} as const;

export const MCP_REQUESTABLE_SCOPES = Object.values(MCP_SCOPES).filter(
  (scope) => scope !== MCP_SCOPES.AUTHORING && scope !== MCP_SCOPES.SEARCH,
);
