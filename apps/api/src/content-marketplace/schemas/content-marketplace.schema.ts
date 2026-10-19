import { CONTENT_MARKETPLACE_SORT, CONTENT_MARKETPLACE_DURATIONS } from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";

import { pagination, UUIDSchema } from "src/common";
import { NATIVE_ARCHIVE_IMPORT_OUTCOMES } from "src/native-archive/native-archive.constants";

import {
  CONTENT_MARKETPLACE_CATALOG_LIMITS,
  CONTENT_MARKETPLACE_COPY_STATUSES,
  CONTENT_MARKETPLACE_EVENT_TYPES,
  CONTENT_MARKETPLACE_IMPORT_SOURCE_KIND,
} from "../content-marketplace.constants";

export const contentMarketplaceListingMetadataSchema = Type.Object({
  category: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
  durationMinutes: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  lessonCount: Type.Integer({ minimum: 0 }),
});

export const contentMarketplaceListingSchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
  description: Type.String(),
  locales: Type.Array(Type.String()),
  hasThumbnail: Type.Boolean(),
  versionId: UUIDSchema,
  metadata: contentMarketplaceListingMetadataSchema,
  updatedAt: Type.String(),
});

export const contentMarketplaceListingsSchema = Type.Array(contentMarketplaceListingSchema);

export const contentMarketplaceCopiedCourseSchema = Type.Object({
  id: UUIDSchema,
  isOutdated: Type.Boolean(),
});

export const contentMarketplaceTenantListingSchema = Type.Intersect([
  contentMarketplaceListingSchema,
  Type.Object({
    copiedCourse: Type.Union([contentMarketplaceCopiedCourseSchema, Type.Null()]),
  }),
]);

export const contentMarketplaceTenantListingsSchema = Type.Array(
  contentMarketplaceTenantListingSchema,
);

export const contentMarketplaceCatalogQuerySchema = Type.Object({
  keyword: Type.Optional(
    Type.String({ maxLength: CONTENT_MARKETPLACE_CATALOG_LIMITS.KEYWORD_MAX_LENGTH }),
  ),
  category: Type.Optional(
    Type.String({
      minLength: 1,
      maxLength: CONTENT_MARKETPLACE_CATALOG_LIMITS.CATEGORY_MAX_LENGTH,
    }),
  ),
  duration: Type.Optional(Type.Enum(CONTENT_MARKETPLACE_DURATIONS)),
  sortBy: Type.Optional(Type.Enum(CONTENT_MARKETPLACE_SORT)),
  page: Type.Integer({ minimum: 1, maximum: CONTENT_MARKETPLACE_CATALOG_LIMITS.MAX_PAGE }),
  perPage: Type.Integer({ minimum: 1, maximum: CONTENT_MARKETPLACE_CATALOG_LIMITS.MAX_PAGE_SIZE }),
});

export const contentMarketplaceCatalogPageSchema = Type.Object({
  data: contentMarketplaceListingsSchema,
  pagination,
});

export const contentMarketplaceCatalogFiltersSchema = Type.Object({
  categories: Type.Array(Type.String()),
});

export type ContentMarketplaceCatalogQuery = Static<typeof contentMarketplaceCatalogQuerySchema>;

export const contentMarketplaceAcquisitionSchema = Type.Object({
  acquisitionId: UUIDSchema,
  versionId: UUIDSchema,
});

export const contentMarketplaceEventReceiptSchema = Type.Object({
  eventId: UUIDSchema,
  duplicate: Type.Boolean(),
});

export const contentMarketplaceAvailabilitySchema = Type.Object({ enabled: Type.Boolean() });

export const contentMarketplaceCopySchema = Type.Object({
  jobId: Type.String(),
  acquisitionId: UUIDSchema,
});

export const contentMarketplaceImportSourceSchema = Type.Object({
  kind: Type.Literal(CONTENT_MARKETPLACE_IMPORT_SOURCE_KIND),
  listingId: UUIDSchema,
  versionId: UUIDSchema,
  acquisitionId: UUIDSchema,
});

export const nativeArchiveImportFinishedEventSchema = Type.Object({
  tenantId: UUIDSchema,
  jobId: Type.String(),
  actorId: UUIDSchema,
  outcome: Type.Enum(NATIVE_ARCHIVE_IMPORT_OUTCOMES),
  courseId: Type.Union([UUIDSchema, Type.Null()]),
  failureCode: Type.Union([Type.String(), Type.Null()]),
  importSource: Type.Record(Type.String(), Type.String()),
  finishedAt: Type.String(),
});

export const contentMarketplaceCourseCopiedEventSchema = Type.Object({
  tenantId: UUIDSchema,
  acquisitionId: UUIDSchema,
  status: Type.Enum(CONTENT_MARKETPLACE_COPY_STATUSES),
  courseId: Type.Union([UUIDSchema, Type.Null()]),
  occurredAt: Type.String(),
});

export const courseDuplicatedEventSchema = Type.Object({
  tenantId: UUIDSchema,
  sourceCourseId: UUIDSchema,
  courseId: UUIDSchema,
  actorId: UUIDSchema,
  duplicatedAt: Type.String(),
});

export const contentMarketplaceAnalyticsEventSchema = Type.Union([
  Type.Object({
    id: UUIDSchema,
    type: Type.Literal(CONTENT_MARKETPLACE_EVENT_TYPES.COURSE_COPIED),
    occurredAt: Type.String(),
    acquisitionId: UUIDSchema,
    status: Type.Enum(CONTENT_MARKETPLACE_COPY_STATUSES),
    courseId: Type.Union([UUIDSchema, Type.Null()]),
  }),
  Type.Object({
    id: UUIDSchema,
    type: Type.Literal(CONTENT_MARKETPLACE_EVENT_TYPES.COURSE_DUPLICATED),
    occurredAt: Type.String(),
    listingId: UUIDSchema,
    acquisitionId: UUIDSchema,
    courseId: UUIDSchema,
    parentCourseId: UUIDSchema,
  }),
]);

export const contentMarketplaceEventDeliverySchema = Type.Object({
  tenantId: UUIDSchema,
  event: contentMarketplaceAnalyticsEventSchema,
});

export type ContentMarketplaceListing = Static<typeof contentMarketplaceListingSchema>;
export type ContentMarketplaceTenantListing = Static<typeof contentMarketplaceTenantListingSchema>;
export type ContentMarketplaceAcquisition = Static<typeof contentMarketplaceAcquisitionSchema>;
export type ContentMarketplaceAvailability = Static<typeof contentMarketplaceAvailabilitySchema>;
export type ContentMarketplaceCopy = Static<typeof contentMarketplaceCopySchema>;
export type ContentMarketplaceImportSource = Static<typeof contentMarketplaceImportSourceSchema>;
export type ContentMarketplaceAnalyticsEvent = Static<
  typeof contentMarketplaceAnalyticsEventSchema
>;
export type ContentMarketplaceEventDelivery = Static<typeof contentMarketplaceEventDeliverySchema>;
