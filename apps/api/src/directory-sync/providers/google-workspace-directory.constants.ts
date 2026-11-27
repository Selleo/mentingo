export const GOOGLE_WORKSPACE_DIRECTORY_SCOPES = [
  "https://www.googleapis.com/auth/admin.directory.user.readonly",
  "https://www.googleapis.com/auth/admin.directory.group.readonly",
  "https://www.googleapis.com/auth/admin.directory.orgunit.readonly",
];

export const GOOGLE_WORKSPACE_PAGE_SIZE = {
  USERS: 500,
  GROUP_MEMBERS: 200,
  GROUP_SEARCH: 50,
} as const;

export const GOOGLE_WORKSPACE_MEMBER_TYPES = {
  USER: "USER",
} as const;

export const GOOGLE_WORKSPACE_ACCESS_DENIED_STATUSES = [401, 403];

export const GOOGLE_WORKSPACE_NOT_FOUND_STATUS = 404;

export const GOOGLE_WORKSPACE_GROUP_SEARCH_DISALLOWED_CHARACTERS = /[^a-zA-Z0-9._@-]/g;
