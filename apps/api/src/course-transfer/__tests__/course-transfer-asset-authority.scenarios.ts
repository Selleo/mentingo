export const KEY_OWNERS = {
  SOURCE_TENANT: "the source tenant",
  NO_TENANT: "no tenant (a legacy key)",
  OTHER_TENANT: "another tenant",
} as const;

export const SOURCE_ASSET_FIELDS = {
  LESSON_VIDEO: "lesson video",
  COURSE_THUMBNAIL: "course thumbnail",
  LESSON_ATTACHMENT: "lesson attachment",
} as const;

export type KeyOwner = (typeof KEY_OWNERS)[keyof typeof KEY_OWNERS];
export type SourceAssetField = (typeof SOURCE_ASSET_FIELDS)[keyof typeof SOURCE_ASSET_FIELDS];

export const SOURCE_ASSET_EXTENSIONS: Record<SourceAssetField, string> = {
  [SOURCE_ASSET_FIELDS.LESSON_VIDEO]: ".mp4",
  [SOURCE_ASSET_FIELDS.COURSE_THUMBNAIL]: ".png",
  [SOURCE_ASSET_FIELDS.LESSON_ATTACHMENT]: ".pdf",
};

/** Every asset field crossed with every key owner. */
export const SHARING_AUTHORITY_CASES = Object.values(SOURCE_ASSET_FIELDS).flatMap((field) =>
  Object.values(KEY_OWNERS).map((owner) => ({ field, owner })),
);

export const DUPLICATION_AUTHORITY_CASES = [
  { owner: KEY_OWNERS.SOURCE_TENANT, state: "completed", failedReason: null },
  { owner: KEY_OWNERS.NO_TENANT, state: "completed", failedReason: null },
  {
    owner: KEY_OWNERS.OTHER_TENANT,
    state: "failed",
    failedReason: "courseDuplication.error.foreignSourceAsset",
  },
];
