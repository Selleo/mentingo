import { ACTIVITY_LOG_RESOURCE_TYPES, type ActivityLogResourceType } from "@repo/shared";

import { getStringProperty, isRecord } from "src/common/utils/object.utils";

type ResourceNameFields = {
  snapshot: string;
  deletionContext?: string;
};

const resourceNameFields: Partial<Record<ActivityLogResourceType, ResourceNameFields>> = {
  [ACTIVITY_LOG_RESOURCE_TYPES.COURSE]: { snapshot: "title", deletionContext: "courseTitle" },
  [ACTIVITY_LOG_RESOURCE_TYPES.CHAPTER]: { snapshot: "title", deletionContext: "chapterName" },
  [ACTIVITY_LOG_RESOURCE_TYPES.LESSON]: { snapshot: "title", deletionContext: "lessonName" },
  [ACTIVITY_LOG_RESOURCE_TYPES.ANNOUNCEMENT]: { snapshot: "title" },
  [ACTIVITY_LOG_RESOURCE_TYPES.GROUP]: { snapshot: "name", deletionContext: "groupName" },
  [ACTIVITY_LOG_RESOURCE_TYPES.CATEGORY]: { snapshot: "title", deletionContext: "categoryName" },
  [ACTIVITY_LOG_RESOURCE_TYPES.QA]: { snapshot: "title", deletionContext: "qaTitle" },
  [ACTIVITY_LOG_RESOURCE_TYPES.NEWS]: { snapshot: "title", deletionContext: "title" },
  [ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE]: { snapshot: "title", deletionContext: "title" },
  [ACTIVITY_LOG_RESOURCE_TYPES.ARTICLE_SECTION]: { snapshot: "title", deletionContext: "title" },
  [ACTIVITY_LOG_RESOURCE_TYPES.LIVE_TRAINING]: { snapshot: "title", deletionContext: "title" },
  [ACTIVITY_LOG_RESOURCE_TYPES.LEARNING_PATH]: { snapshot: "title" },
};

const getUserName = (snapshot: Record<string, unknown>) => {
  const fullName = [
    getStringProperty(snapshot, "firstName"),
    getStringProperty(snapshot, "lastName"),
  ]
    .filter(Boolean)
    .join(" ");

  return fullName || getStringProperty(snapshot, "email");
};

export const getActivityLogMetadataResourceName = (
  metadata: unknown,
  resourceType: string | null,
): string | null => {
  if (!resourceType || !isRecord(metadata)) return null;

  const snapshots = [metadata.after, metadata.before].filter(isRecord);
  const context = isRecord(metadata.context) ? metadata.context : null;

  if (resourceType === ACTIVITY_LOG_RESOURCE_TYPES.USER) {
    for (const snapshot of snapshots) {
      const name = getUserName(snapshot);
      if (name) return name;
    }

    return context ? getStringProperty(context, "email") : null;
  }

  const fields = resourceNameFields[resourceType as ActivityLogResourceType];

  if (!fields) return null;

  for (const snapshot of snapshots) {
    const name = getStringProperty(snapshot, fields.snapshot);
    if (name) return name;
  }

  return context && fields.deletionContext
    ? getStringProperty(context, fields.deletionContext)
    : null;
};
