import { Inject, Injectable } from "@nestjs/common";
import { SCORM_PACKAGE_ENTITY_TYPE, SCORM_PACKAGE_STATUS, SCORM_STANDARD } from "@repo/shared";
import { and, eq } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { chapters, courses, lessons, scormPackages, scormScos } from "src/storage/schema";

import { getScormExtractedFileReference, getScormScoLaunchReference } from "../scorm-storage-paths";

import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  PersistCoursePackageParams,
  PersistLessonPackageParams,
  ScormScoManifest,
} from "src/scorm/scorm.types";

@Injectable()
export class ScormRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  async persistCoursePackage(params: PersistCoursePackageParams, dbInstance?: DatabasePg) {
    const persist = async (trx: DatabasePg) => {
      const [createdPackage] = await trx
        .insert(scormPackages)
        .values({
          id: params.packageId,
          entityType: SCORM_PACKAGE_ENTITY_TYPE.COURSE,
          entityId: params.courseId,
          standard: SCORM_STANDARD.SCORM_1_2,
          originalFileReference: params.originalFileReference,
          extractedFilesReference: params.extractedFilesReference,
          manifestEntryPoint: getScormScoLaunchReference(
            params.currentUser.tenantId,
            params.packageId,
            params.manifestEntryPoint,
          ),
          manifestJson: {
            ...params.manifest,
            manifestReference: params.manifestReference,
          },
          status: SCORM_PACKAGE_STATUS.PROCESSING,
          tenantId: params.currentUser.tenantId,
        })
        .returning();

      for (const sco of params.manifest.scos) {
        const [chapter] = await trx
          .insert(chapters)
          .values({
            courseId: params.courseId,
            authorId: params.currentUser.userId,
            title: buildJsonbField(params.metadata.language, sco.item.title),
            displayOrder: sco.displayOrder,
            lessonCount: 1,
            tenantId: params.currentUser.tenantId,
          })
          .returning();

        const [lesson] = await trx
          .insert(lessons)
          .values({
            chapterId: chapter.id,
            type: LESSON_TYPES.SCORM,
            title: buildJsonbField(params.metadata.language, sco.item.title),
            description: buildJsonbField(params.metadata.language, ""),
            displayOrder: 1,
            tenantId: params.currentUser.tenantId,
          })
          .returning();

        await trx.insert(scormScos).values(
          this.buildScoLessonLink({
            packageId: createdPackage.id,
            lessonId: lesson.id,
            organizationIdentifier: params.manifest.organizationIdentifier,
            sco,
            currentUser: params.currentUser,
          }),
        );
      }

      await trx
        .update(courses)
        .set({ chapterCount: params.manifest.scos.length })
        .where(eq(courses.id, params.courseId));
    };

    if (dbInstance) {
      await persist(dbInstance);
      return;
    }

    await this.db.transaction(persist);
  }

  async persistLessonPackage(params: PersistLessonPackageParams, dbInstance?: DatabasePg) {
    const persist = async (trx: DatabasePg) => {
      const [createdPackage] = await trx
        .insert(scormPackages)
        .values({
          id: params.packageId,
          entityType: SCORM_PACKAGE_ENTITY_TYPE.LESSON,
          entityId: params.lessonId,
          standard: SCORM_STANDARD.SCORM_1_2,
          originalFileReference: params.originalFileReference,
          extractedFilesReference: params.extractedFilesReference,
          manifestEntryPoint: getScormScoLaunchReference(
            params.currentUser.tenantId,
            params.packageId,
            params.manifestEntryPoint,
          ),
          manifestJson: {
            ...params.manifest,
            manifestReference: params.manifestReference,
          },
          status: SCORM_PACKAGE_STATUS.PROCESSING,
          tenantId: params.currentUser.tenantId,
        })
        .returning();

      for (const sco of params.manifest.scos) {
        await trx.insert(scormScos).values(
          this.buildScoLessonLink({
            packageId: createdPackage.id,
            lessonId: params.lessonId,
            organizationIdentifier: params.manifest.organizationIdentifier,
            sco,
            currentUser: params.currentUser,
          }),
        );
      }
    };

    if (dbInstance) {
      await persist(dbInstance);
      return;
    }

    await this.db.transaction(persist);
  }

  async markPackageReady(packageId: string, tenantId: string) {
    await this.db
      .update(scormPackages)
      .set({ status: SCORM_PACKAGE_STATUS.READY })
      .where(and(eq(scormPackages.id, packageId), eq(scormPackages.tenantId, tenantId)));
  }

  async deleteImportedCourse(courseId: string, tenantId: string) {
    await this.db
      .delete(scormPackages)
      .where(
        and(
          eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.COURSE),
          eq(scormPackages.entityId, courseId),
          eq(scormPackages.tenantId, tenantId),
        ),
      );

    await this.db
      .delete(courses)
      .where(and(eq(courses.id, courseId), eq(courses.tenantId, tenantId)));
  }

  async deleteImportedLesson(lessonId: string, tenantId: string) {
    await this.db
      .delete(scormPackages)
      .where(
        and(
          eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.LESSON),
          eq(scormPackages.entityId, lessonId),
          eq(scormPackages.tenantId, tenantId),
        ),
      );

    await this.db
      .delete(lessons)
      .where(and(eq(lessons.id, lessonId), eq(lessons.tenantId, tenantId)));
  }

  private buildScoLessonLink(params: {
    packageId: string;
    lessonId: string;
    organizationIdentifier?: string;
    sco: ScormScoManifest;
    currentUser: CurrentUserType;
  }): typeof scormScos.$inferInsert {
    return {
      packageId: params.packageId,
      lessonId: params.lessonId,
      organizationIdentifier: params.organizationIdentifier,
      identifier: params.sco.item.identifier,
      identifierRef: params.sco.item.identifierRef,
      resourceIdentifier: params.sco.resource.identifier,
      resourceType: params.sco.resource.type,
      scormType: params.sco.resource.scormType,
      title: params.sco.item.title,
      href: params.sco.href,
      launchPath: getScormScoLaunchReference(
        params.currentUser.tenantId,
        params.packageId,
        params.sco.href,
      ),
      parameters: params.sco.item.parameters,
      displayOrder: params.sco.displayOrder,
      parentIdentifier: params.sco.item.parentIdentifier,
      isVisible: params.sco.item.isVisible,
      itemMetadataJson: params.sco.item,
      resourceMetadataJson: {
        ...params.sco.resource,
        files: params.sco.files,
        fileReferences: params.sco.files.map((file) =>
          getScormExtractedFileReference(params.currentUser.tenantId, params.packageId, file),
        ),
      },
      tenantId: params.currentUser.tenantId,
    };
  }
}
