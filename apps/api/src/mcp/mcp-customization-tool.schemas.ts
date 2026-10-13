import {
  ALLOWED_AVATAR_IMAGE_TYPES,
  ALLOWED_LESSON_IMAGE_FILE_TYPES,
  LOGIN_PAGE_DOCUMENTS_FILE_TYPES,
} from "@repo/shared";
import { Type } from "@sinclair/typebox";
import type { TSchema } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { FILE_SIZE_BASE } from "src/common/constants";
import { MAX_FILE_SIZE } from "src/file/file.constants";
import { updateRegistrationFormSchema } from "src/settings/schemas/registration-form.schema";
import { companyInformationJSONSchema } from "src/settings/schemas/settings.schema";
import {
  updateAgeLimitSchema,
  updateDefaultCourseCurrencySchema,
  updateFeaturedCourseSchema,
  updateGlobalColorSchema,
  updateLiveTrainingMaxParallelSessionsSchema,
} from "src/settings/schemas/update-settings.schema";

function strict<T extends TSchema>(schema: T): T {
  function clone(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(clone);
    if (!value || typeof value !== "object") return value;
    const copy = { ...value } as Record<string, unknown>;
    for (const [key, item] of Object.entries(copy)) copy[key] = clone(item);
    if (copy.type === "object" && copy.properties) copy.additionalProperties = false;
    return copy;
  }
  return clone(schema) as T;
}

export const customizationReadInputSchema = Type.Object({}, { additionalProperties: false });
export const customizationColorsInputSchema = strict(updateGlobalColorSchema);
export const customizationCompanyInputSchema = strict(companyInformationJSONSchema);
export const customizationRegistrationInputSchema = strict(updateRegistrationFormSchema);
export const customizationCurrencyInputSchema = strict(updateDefaultCourseCurrencySchema);
export const customizationAgeLimitInputSchema = strict(updateAgeLimitSchema);
export const customizationFeaturedCourseInputSchema = strict(updateFeaturedCourseSchema);
export const customizationLiveTrainingCapacityInputSchema = strict(
  updateLiveTrainingMaxParallelSessionsSchema,
);
export const customizationFlagInputSchema = Type.Object(
  {
    idempotencyKey: Type.String({ minLength: 1, maxLength: 200 }),
    setting: Type.Union(
      (
        [
          "unregisteredUserCoursesAccessibility",
          "modernCourseListEnabled",
          "courseDiscussionsEnabled",
          "calendarEnabled",
          "liveTrainingEnabled",
          "learningPathsEnabled",
          "inviteOnlyRegistration",
          "QAEnabled",
          "unregisteredUserQAAccessibility",
          "newsEnabled",
          "unregisteredUserNewsAccessibility",
          "articlesEnabled",
          "unregisteredUserArticlesAccessibility",
        ] as const
      ).map((setting) => Type.Literal(setting)),
    ),
  },
  { additionalProperties: false },
);
export const customizationImageKindSchema = Type.Union(
  (["platformLogo", "platformSimpleLogo", "loginBackground", "certificateBackground"] as const).map(
    (kind) => Type.Literal(kind),
  ),
);
const uploadMetadata = {
  filename: Type.String({ minLength: 1, maxLength: 255, pattern: "^[^/\\\\]+$" }),
  size: Type.Integer({ minimum: 1 }),
};
export const customizationImageInputSchema = Type.Object(
  {
    kind: customizationImageKindSchema,
    ...uploadMetadata,
    size: Type.Integer({ minimum: 1, maximum: FILE_SIZE_BASE }),
    mimeType: Type.Union(
      [...new Set([...ALLOWED_AVATAR_IMAGE_TYPES, ...ALLOWED_LESSON_IMAGE_FILE_TYPES])].map(
        (mime) => Type.Literal(mime),
      ),
    ),
  },
  { additionalProperties: false },
);
export const customizationRemoveImageInputSchema = Type.Object(
  { kind: customizationImageKindSchema },
  { additionalProperties: false },
);
export const customizationLoginFileInputSchema = Type.Object(
  {
    ...uploadMetadata,
    name: Type.String({ minLength: 1, maxLength: 255 }),
    size: Type.Integer({ minimum: 1, maximum: MAX_FILE_SIZE }),
    mimeType: Type.Union(LOGIN_PAGE_DOCUMENTS_FILE_TYPES.map((mime) => Type.Literal(mime))),
  },
  { additionalProperties: false },
);
export const customizationDeleteLoginFileInputSchema = Type.Object(
  {
    id: UUIDSchema,
    confirmName: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);
