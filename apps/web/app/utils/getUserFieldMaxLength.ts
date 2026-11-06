import { MAX_USER_NAME_LENGTH } from "@repo/shared";

const USER_NAME_FIELDS = new Set(["firstName", "lastName"]);

/** Native input limit for user profile fields, matching the API's name length validation. */
export const getUserFieldMaxLength = (fieldName: string) =>
  USER_NAME_FIELDS.has(fieldName) ? MAX_USER_NAME_LENGTH : undefined;
