import { Type, type Static } from "@sinclair/typebox";

export const learningPathSettingsSchema = Type.Object(
  {
    certificateSignature: Type.Union([Type.String(), Type.Null()], { default: null }),
    certificateFontColor: Type.Union([Type.String(), Type.Null()], { default: null }),
  },
  { additionalProperties: false },
);

export const learningPathSettingsResponseSchema = Type.Object(
  {
    certificateSignatureUrl: Type.Union([Type.String(), Type.Null()]),
    certificateFontColor: Type.Union([Type.String(), Type.Null()]),
  },
  { additionalProperties: false },
);

export const updateLearningPathSettingsSchema = Type.Partial(
  Type.Object(
    {
      certificateFontColor: Type.Union([Type.String(), Type.Null()]),
      removeCertificateSignature: Type.Boolean(),
    },
    { additionalProperties: false },
  ),
);

export type LearningPathSettings = Static<typeof learningPathSettingsSchema>;
export type LearningPathSettingsResponse = Static<typeof learningPathSettingsResponseSchema>;
export type UpdateLearningPathSettings = Static<typeof updateLearningPathSettingsSchema>;

export const DEFAULT_LEARNING_PATH_SETTINGS: LearningPathSettings = {
  certificateSignature: null,
  certificateFontColor: null,
};
