import { sql } from "drizzle-orm";

import { courses, users } from "src/storage/schema";

const normalizedCourseAuthorMetadataSql = () => sql`
  CASE
    WHEN jsonb_typeof(${courses.authorMetadata}::jsonb) = 'object'
      THEN ${courses.authorMetadata}::jsonb
    WHEN jsonb_typeof(${courses.authorMetadata}::jsonb) = 'string'
      THEN (${courses.authorMetadata}::jsonb #>> '{}')::jsonb
    ELSE '{}'::jsonb
  END
`;

export const courseAuthorNameSql = () =>
  sql<string>`COALESCE(
    NULLIF(
      CONCAT_WS(
        ' ',
        jsonb_extract_path_text(${normalizedCourseAuthorMetadataSql()}, 'firstName'),
        jsonb_extract_path_text(${normalizedCourseAuthorMetadataSql()}, 'lastName')
      ),
      ''
    ),
    CONCAT_WS(' ', ${users.firstName}, ${users.lastName})
  )`;

export const courseAuthorAvatarReferenceSql = () =>
  sql<string>`COALESCE(
    jsonb_extract_path_text(
      ${normalizedCourseAuthorMetadataSql()},
      'profilePictureReference'
    ),
    ${users.avatarReference}
  )`;
