import { Injectable, NotFoundException } from "@nestjs/common";
import { isEqual } from "lodash";

import { LocalizationService } from "src/localization/localization.service";
import { ENTITY_TYPE } from "src/localization/localization.types";

import { CourseEditingRepository } from "./course-editing.repository";

import type { SupportedLanguages } from "@repo/shared";
import type { CourseActivityLogSnapshot } from "src/activity-logs/types";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class CourseActivitySnapshotService {
  constructor(
    private readonly courseEditingRepository: CourseEditingRepository,
    private readonly localizationService: LocalizationService,
  ) {}

  /** Captures the course fields the activity log diffs before and after an edit. */
  async buildCourseActivitySnapshot(
    courseId: UUIDType,
    language?: SupportedLanguages,
    db?: DatabasePg,
  ): Promise<CourseActivityLogSnapshot> {
    const {
      language: resolvedLanguage,
      baseLanguage,
      availableLocales,
    } = await this.localizationService.getBaseLanguage(ENTITY_TYPE.COURSE, courseId, language);

    const course = await this.courseEditingRepository.findCourseActivitySnapshot(
      courseId,
      resolvedLanguage,
      db,
    );

    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.course");

    return {
      ...course,
      baseLanguage,
      availableLocales: Array.isArray(availableLocales) ? availableLocales : [availableLocales],
    };
  }

  areCourseSnapshotsEqual(
    previousSnapshot: CourseActivityLogSnapshot | null,
    updatedSnapshot: CourseActivityLogSnapshot | null,
  ) {
    return isEqual(previousSnapshot, updatedSnapshot);
  }
}
