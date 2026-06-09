import { ENTITY_TYPES, type EntityType } from "@repo/shared";

import { baseUrl } from "~/utils/baseUrl";

export const buildEntityResourceUrl = (resourceId: string, entityType: EntityType) => {
  switch (entityType) {
    case ENTITY_TYPES.LESSON:
      return `${baseUrl}/api/lesson/lesson-resource/${resourceId}`;
    case ENTITY_TYPES.ARTICLES:
      return `${baseUrl}/api/articles/articles-resource/${resourceId}`;
    case ENTITY_TYPES.NEWS:
      return `${baseUrl}/api/news/news-resource/${resourceId}`;
    default:
      return `${baseUrl}/api/lesson/lesson-resource/${resourceId}`;
  }
};
