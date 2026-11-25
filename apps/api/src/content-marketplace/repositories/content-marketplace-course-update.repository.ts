import { Inject, Injectable } from "@nestjs/common";
import { PERMISSIONS, SUPPORTED_LANGUAGES } from "@repo/shared";
import { and, asc, eq, inArray, isNull, type SQL } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { userHasPermissionCondition } from "src/common/permissions/permission-sql.utils";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { courses, users } from "src/storage/schema";

import type {
  ContentMarketplaceCourseUpdateRecipient,
  ContentMarketplaceUpdatedCourseTitles,
} from "../content-marketplace.types";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class ContentMarketplaceCourseUpdateRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  /** Active admins who can open the content marketplace to sync the course. */
  async findCourseUpdateRecipients(
    tenantId: UUIDType,
  ): Promise<ContentMarketplaceCourseUpdateRecipient[]> {
    return this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(users.archived, false),
          isNull(users.deletedAt),
          userHasPermissionCondition(this.db, users.id, users.tenantId, PERMISSIONS.TENANT_MANAGE),
          userHasPermissionCondition(
            this.db,
            users.id,
            users.tenantId,
            PERMISSIONS.CONTENT_MARKETPLACE_BROWSE,
          ),
        ),
      )
      .orderBy(asc(users.createdAt), asc(users.id));
  }

  /** Each course's title in every supported language, falling back to its base language. */
  async findCourseTitlesByLanguage(
    courseIds: UUIDType[],
  ): Promise<ContentMarketplaceUpdatedCourseTitles[]> {
    if (!courseIds.length) return [];

    const localizedTitleFields = Object.fromEntries(
      Object.values(SUPPORTED_LANGUAGES).map((language) => [
        language,
        this.localizationService.getLocalizedSqlField(courses.title, language, courses),
      ]),
    ) as Record<SupportedLanguages, SQL<string>>;

    return this.db
      .select({ courseId: courses.id, ...localizedTitleFields })
      .from(courses)
      .where(inArray(courses.id, courseIds));
  }
}
