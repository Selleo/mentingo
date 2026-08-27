import { sql } from "drizzle-orm";

import { courses, users } from "src/storage/schema";

export const courseAuthorNameSql = () =>
  sql<string>`COALESCE(
    NULLIF(
      CONCAT_WS(
        ' ',
        jsonb_extract_path_text(${courses.authorMetadata}::jsonb, 'firstName'),
        jsonb_extract_path_text(${courses.authorMetadata}::jsonb, 'lastName')
      ),
      ''
    ),
    CONCAT_WS(' ', ${users.firstName}, ${users.lastName})
  )`;

export const courseAuthorAvatarReferenceSql = () =>
  sql<string>`COALESCE(
    jsonb_extract_path_text(${courses.authorMetadata}::jsonb, 'profilePictureReference'),
    ${users.avatarReference}
  )`;
