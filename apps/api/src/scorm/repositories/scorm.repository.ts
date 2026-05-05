import { Inject, Injectable } from "@nestjs/common";
import {
  COURSE_ENROLLMENT,
  SCORM_PACKAGE_ENTITY_TYPE,
  SCORM_PACKAGE_STATUS,
  SCORM_STANDARD,
} from "@repo/shared";
import { and, asc, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import {
  chapters,
  courses,
  lessons,
  scormAttempts,
  scormPackages,
  scormRuntimeState,
  scormScos,
  studentCourses,
} from "src/storage/schema";

import { getScormExtractedFileReference, getScormScoLaunchReference } from "../scorm-storage-paths";

import type { ScormCompletionStatus } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  PersistCoursePackageParams,
  PersistLessonPackageParams,
  ScormScoManifest,
  UpsertScormRuntimeState,
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

  async markPackageReady(packageId: string) {
    await this.db
      .update(scormPackages)
      .set({ status: SCORM_PACKAGE_STATUS.READY })
      .where(eq(scormPackages.id, packageId));
  }

  async findLaunchableSco(params: { lessonId: string; scoId?: string }) {
    const conditions = [
      eq(scormScos.lessonId, params.lessonId),
      eq(scormPackages.status, SCORM_PACKAGE_STATUS.READY),
    ];

    if (params.scoId) {
      conditions.push(eq(scormScos.id, params.scoId));
    }

    const [sco] = await this.db
      .select({
        packageId: scormPackages.id,
        packageEntityType: scormPackages.entityType,
        packageEntityId: scormPackages.entityId,
        standard: scormPackages.standard,
        extractedFilesReference: scormPackages.extractedFilesReference,
        scoId: scormScos.id,
        lessonId: scormScos.lessonId,
        launchPath: scormScos.launchPath,
        scoTitle: scormScos.title,
        displayOrder: scormScos.displayOrder,
        courseId: chapters.courseId,
        lessonType: lessons.type,
      })
      .from(scormScos)
      .innerJoin(scormPackages, eq(scormPackages.id, scormScos.packageId))
      .innerJoin(lessons, eq(lessons.id, scormScos.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(and(...conditions))
      .orderBy(asc(scormScos.displayOrder))
      .limit(1);

    return sco;
  }

  async findScoNavigation(params: { packageId: string; lessonId: string; scoId: string }) {
    const packageScos = await this.db
      .select({
        id: scormScos.id,
        displayOrder: scormScos.displayOrder,
      })
      .from(scormScos)
      .where(
        and(eq(scormScos.packageId, params.packageId), eq(scormScos.lessonId, params.lessonId)),
      )
      .orderBy(asc(scormScos.displayOrder));

    const currentIndex = packageScos.findIndex((sco) => sco.id === params.scoId);

    return {
      previousScoId: this.getPreviousScoId(packageScos, currentIndex),
      nextScoId: this.getNextScoId(packageScos, currentIndex),
    };
  }

  private getPreviousScoId(scos: { id: string }[], currentIndex: number) {
    if (currentIndex <= 0) {
      return null;
    }

    return scos[currentIndex - 1].id;
  }

  private getNextScoId(scos: { id: string }[], currentIndex: number) {
    const currentScoNotFound = currentIndex < 0;
    const currentScoIsLast = currentIndex >= scos.length - 1;

    if (currentScoNotFound || currentScoIsLast) {
      return null;
    }

    return scos[currentIndex + 1].id;
  }

  async findOrCreateAttempt(params: {
    studentId: string;
    courseId: string;
    lessonId: string;
    packageId: string;
    scoId: string;
  }) {
    const [existingAttempt] = await this.db
      .select()
      .from(scormAttempts)
      .where(
        and(
          eq(scormAttempts.studentId, params.studentId),
          eq(scormAttempts.packageId, params.packageId),
          eq(scormAttempts.scoId, params.scoId),
        ),
      )
      .orderBy(desc(scormAttempts.attemptNumber))
      .limit(1);

    if (existingAttempt) {
      return {
        attempt: existingAttempt,
        isNewAttempt: false,
      };
    }

    const [createdAttempt] = await this.db
      .insert(scormAttempts)
      .values({
        studentId: params.studentId,
        courseId: params.courseId,
        lessonId: params.lessonId,
        packageId: params.packageId,
        scoId: params.scoId,
        attemptNumber: 1,
      })
      .returning();

    await this.db.insert(scormRuntimeState).values({
      attemptId: createdAttempt.id,
      rawCmiJson: {},
    });

    return {
      attempt: createdAttempt,
      isNewAttempt: true,
    };
  }

  async findRuntimeState(attemptId: string) {
    const [runtimeState] = await this.db
      .select()
      .from(scormRuntimeState)
      .where(eq(scormRuntimeState.attemptId, attemptId))
      .limit(1);

    return runtimeState;
  }

  async findAttemptContext(attemptId: string) {
    const [attempt] = await this.db
      .select({
        ...getTableColumns(scormAttempts),
        scoLessonId: scormScos.lessonId,
      })
      .from(scormAttempts)
      .innerJoin(scormPackages, eq(scormPackages.id, scormAttempts.packageId))
      .innerJoin(scormScos, eq(scormScos.id, scormAttempts.scoId))
      .where(eq(scormAttempts.id, attemptId))
      .limit(1);

    return attempt;
  }

  async upsertRuntimeState(params: UpsertScormRuntimeState) {
    const [runtimeState] = await this.db
      .insert(scormRuntimeState)
      .values(params)
      .onConflictDoUpdate({
        target: [scormRuntimeState.attemptId],
        set: {
          ...params,
          updatedAt: sql`now()`,
        },
      })
      .returning();

    return runtimeState;
  }

  async markAttemptCompleted(attemptId: string) {
    await this.db
      .update(scormAttempts)
      .set({ completedAt: sql`now()` })
      .where(eq(scormAttempts.id, attemptId));
  }

  async areAllLessonScosCompleted(params: {
    studentId: string;
    packageId: string;
    lessonId: string;
    completedStatuses: ScormCompletionStatus[];
  }) {
    const [completion] = await this.db
      .select({
        totalCount: sql<number>`COUNT(DISTINCT ${scormScos.id})::int`,
        completedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${inArray(
          scormRuntimeState.completionStatus,
          params.completedStatuses,
        )} THEN ${scormScos.id} END)::int`,
      })
      .from(scormScos)
      .leftJoin(
        scormAttempts,
        and(eq(scormAttempts.scoId, scormScos.id), eq(scormAttempts.studentId, params.studentId)),
      )
      .leftJoin(scormRuntimeState, eq(scormRuntimeState.attemptId, scormAttempts.id))
      .where(
        and(eq(scormScos.packageId, params.packageId), eq(scormScos.lessonId, params.lessonId)),
      );

    return completion.totalCount > 0 && completion.totalCount === completion.completedCount;
  }

  async findPackageById(packageId: string) {
    const [scormPackage] = await this.db
      .select()
      .from(scormPackages)
      .where(eq(scormPackages.id, packageId))
      .limit(1);

    return scormPackage;
  }

  async findPackageAccess(packageId: string, userId: string) {
    const [access] = await this.db
      .select({
        packageId: scormPackages.id,
        courseId: chapters.courseId,
        isAssigned: sql<boolean>`CASE WHEN ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED} THEN TRUE ELSE FALSE END`,
        isFreemium: sql<boolean>`BOOL_OR(${chapters.isFreemium})`,
      })
      .from(scormPackages)
      .innerJoin(scormScos, eq(scormScos.packageId, scormPackages.id))
      .innerJoin(lessons, eq(lessons.id, scormScos.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(
        studentCourses,
        and(eq(studentCourses.courseId, chapters.courseId), eq(studentCourses.studentId, userId)),
      )
      .where(eq(scormPackages.id, packageId))
      .groupBy(scormPackages.id, chapters.courseId, studentCourses.status)
      .limit(1);

    return access;
  }

  async deleteImportedCourse(courseId: string) {
    await this.db
      .delete(scormPackages)
      .where(
        and(
          eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.COURSE),
          eq(scormPackages.entityId, courseId),
        ),
      );

    await this.db.delete(courses).where(eq(courses.id, courseId));
  }

  async deleteImportedLesson(lessonId: string) {
    await this.db
      .delete(scormPackages)
      .where(
        and(
          eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.LESSON),
          eq(scormPackages.entityId, lessonId),
        ),
      );

    await this.db.delete(lessons).where(eq(lessons.id, lessonId));
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
        params.sco.launchPath,
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
    };
  }
}
