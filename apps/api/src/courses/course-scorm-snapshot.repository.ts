import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { resources } from "src/storage/schema";

import type { CourseScormResourceAssetRow } from "./types/scorm-export.types";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class CourseScormSnapshotRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getActiveResourceAssetsByIds(
    resourceIds: UUIDType[],
    language: SupportedLanguages,
  ): Promise<CourseScormResourceAssetRow[]> {
    if (!resourceIds.length) return [];

    return this.db
      .select({
        id: resources.id,
        reference: resources.reference,
        contentType: resources.contentType,
        metadata: resources.metadata,
        title: sql<string>`COALESCE(
          ${this.localizationService.getFieldByLanguage(resources.title, language)},
          ${this.localizationService.getFirstValue(resources.title)},
          ''
        )`,
      })
      .from(resources)
      .where(and(inArray(resources.id, resourceIds), eq(resources.archived, false)))
      .orderBy(resources.createdAt);
  }
}
