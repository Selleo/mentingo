import { Inject, Injectable } from "@nestjs/common";
import {
  COURSE_ORIGIN_TYPES,
  MASTER_COURSE_EXPORT_SYNC_STATUSES,
  PERMISSIONS,
  LEARNING_PATH_ENROLLMENT_TYPES,
  LEARNING_PATH_CERTIFICATE_STATUSES,
  type LearningPathEnrollmentType,
  type LearningPathProgressStatus,
  type LearningPathEntityType,
} from "@repo/shared";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  ne,
  not,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DatabasePg } from "src/common";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { userHasAnyPermissionsCondition } from "src/common/permissions/permission-sql.utils";
import {
  courses,
  groupLearningPaths,
  groups,
  groupUsers,
  learningPathCourses,
  learningPathCertificates,
  learningPathEntityMap,
  learningPathExports,
  learningPaths,
  masterCourseExports,
  studentCourses,
  studentLearningPathCourses,
  studentLearningPaths,
  tenants,
  users,
} from "src/storage/schema";

import type { CreateLearningPathBody } from "./learning-path.schema";
import type {
  LearningPathCourseLink,
  LearningPathCourseProgressRow,
  LearningPathProgressState,
  LearningPathUpdateData,
} from "./learning-path.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { ProgressStatus } from "src/utils/types/progress.type";

@Injectable()
export class LearningPathRepository {
  constructor(@Inject("DB") private readonly db: DatabasePg) {}

  private buildCreateLearningPathValues(
    body: CreateLearningPathBody,
    currentUser: CurrentUserType,
  ) {
    const values: typeof learningPaths.$inferInsert = {
      title: { [body.language]: body.title },
      description: { [body.language]: body.description },
      authorId: currentUser.userId,
      baseLanguage: body.language,
      availableLocales: [body.language],
    };

    if (body.thumbnailReference !== undefined) values.thumbnailReference = body.thumbnailReference;

    if (body.status !== undefined) values.status = body.status;

    if (body.includesCertificate !== undefined) {
      values.includesCertificate = body.includesCertificate;
    }

    if (body.sequenceEnabled !== undefined) values.sequenceEnabled = body.sequenceEnabled;

    return values;
  }

  findLearningPathById(id: UUIDType, dbInstance: DatabasePg = this.db) {
    return dbInstance.query.learningPaths.findFirst({
      where: eq(learningPaths.id, id),
    });
  }

  async getLearningPaths(
    page: number = 1,
    perPage: number = DEFAULT_PAGE_SIZE,
    dbInstance: DatabasePg = this.db,
  ) {
    const queriedLearningPaths = await dbInstance
      .select()
      .from(learningPaths)
      .orderBy(desc(learningPaths.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const [{ totalItems }] = await dbInstance.select({ totalItems: count() }).from(learningPaths);

    return {
      data: queriedLearningPaths,
      pagination: {
        totalItems,
        page,
        perPage,
      },
    };
  }

  async createLearningPath(
    body: CreateLearningPathBody,
    currentUser: CurrentUserType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [createdLearningPath] = await dbInstance
      .insert(learningPaths)
      .values(this.buildCreateLearningPathValues(body, currentUser))
      .returning();

    return createdLearningPath;
  }

  async updateLearningPath(
    id: UUIDType,
    updates: LearningPathUpdateData,
    dbInstance: DatabasePg = this.db,
  ) {
    const [updatedLearningPath] = await dbInstance
      .update(learningPaths)
      .set(updates)
      .where(eq(learningPaths.id, id))
      .returning();

    return updatedLearningPath;
  }

  deleteLearningPath(id: UUIDType, dbInstance: DatabasePg = this.db) {
    return dbInstance.delete(learningPaths).where(eq(learningPaths.id, id)).returning({
      id: learningPaths.id,
    });
  }

  async getLearningPathCourses(
    pathId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ): Promise<LearningPathCourseLink[]> {
    return dbInstance
      .select({
        id: learningPathCourses.id,
        learningPathId: learningPathCourses.learningPathId,
        courseId: learningPathCourses.courseId,
        displayOrder: learningPathCourses.displayOrder,
        createdAt: learningPathCourses.createdAt,
        updatedAt: learningPathCourses.updatedAt,
      })
      .from(learningPathCourses)
      .where(eq(learningPathCourses.learningPathId, pathId))
      .orderBy(learningPathCourses.displayOrder);
  }

  async getLearningPathCourseIds(pathId: UUIDType, dbInstance: DatabasePg = this.db) {
    const learningPathCourseIds = await dbInstance
      .select({
        courseId: learningPathCourses.courseId,
      })
      .from(learningPathCourses)
      .where(eq(learningPathCourses.learningPathId, pathId));

    return learningPathCourseIds.map(({ courseId }) => courseId);
  }

  async getLearningPathStudentIds(pathId: UUIDType, dbInstance: DatabasePg = this.db) {
    const learningPathStudentIds = await dbInstance
      .select({
        studentId: studentLearningPaths.studentId,
      })
      .from(studentLearningPaths)
      .where(eq(studentLearningPaths.learningPathId, pathId));

    return learningPathStudentIds.map(({ studentId }) => studentId);
  }

  async getLearningPathGroupIds(pathId: UUIDType, dbInstance: DatabasePg = this.db) {
    const learningPathGroupIds = await dbInstance
      .select({
        groupId: groupLearningPaths.groupId,
      })
      .from(groupLearningPaths)
      .where(eq(groupLearningPaths.learningPathId, pathId));

    return learningPathGroupIds.map(({ groupId }) => groupId);
  }

  async getLearningPathIdsForStudentCourse(
    studentId: UUIDType,
    courseId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
      .selectDistinct({ learningPathId: studentLearningPathCourses.learningPathId })
      .from(studentLearningPathCourses)
      .innerJoin(
        studentLearningPaths,
        and(
          eq(studentLearningPaths.learningPathId, studentLearningPathCourses.learningPathId),
          eq(studentLearningPaths.studentId, studentLearningPathCourses.studentId),
        ),
      )
      .where(
        and(
          eq(studentLearningPathCourses.studentId, studentId),
          eq(studentLearningPathCourses.courseId, courseId),
        ),
      );
  }

  async getLearningPathIdsByGroupId(groupId: UUIDType, dbInstance: DatabasePg = this.db) {
    return dbInstance
      .select({ learningPathId: groupLearningPaths.learningPathId })
      .from(groupLearningPaths)
      .where(eq(groupLearningPaths.groupId, groupId));
  }

  async getLearningPathSourceSnapshot(learningPathId: UUIDType, dbInstance: DatabasePg = this.db) {
    const [learningPath] = await dbInstance
      .select({
        id: learningPaths.id,
        title: learningPaths.title,
        description: learningPaths.description,
        thumbnailReference: learningPaths.thumbnailReference,
        status: learningPaths.status,
        includesCertificate: learningPaths.includesCertificate,
        sequenceEnabled: learningPaths.sequenceEnabled,
        authorId: learningPaths.authorId,
        originType: learningPaths.originType,
        sourceLearningPathId: learningPaths.sourceLearningPathId,
        sourceTenantId: learningPaths.sourceTenantId,
        baseLanguage: learningPaths.baseLanguage,
        availableLocales: learningPaths.availableLocales,
        tenantId: learningPaths.tenantId,
        createdAt: learningPaths.createdAt,
        updatedAt: learningPaths.updatedAt,
      })
      .from(learningPaths)
      .where(eq(learningPaths.id, learningPathId))
      .limit(1);

    if (!learningPath) return null;

    const courseLinks = await dbInstance
      .select({
        id: learningPathCourses.id,
        learningPathId: learningPathCourses.learningPathId,
        courseId: learningPathCourses.courseId,
        displayOrder: learningPathCourses.displayOrder,
        createdAt: learningPathCourses.createdAt,
        updatedAt: learningPathCourses.updatedAt,
      })
      .from(learningPathCourses)
      .where(eq(learningPathCourses.learningPathId, learningPathId))
      .orderBy(learningPathCourses.displayOrder);

    return { learningPath, courseLinks };
  }

  async findLearningPathExportByPair(
    sourceTenantId: UUIDType,
    sourceLearningPathId: UUIDType,
    targetTenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [exportLink] = await dbInstance
      .select()
      .from(learningPathExports)
      .where(
        and(
          eq(learningPathExports.sourceTenantId, sourceTenantId),
          eq(learningPathExports.sourceLearningPathId, sourceLearningPathId),
          eq(learningPathExports.targetTenantId, targetTenantId),
        ),
      )
      .limit(1);

    return exportLink;
  }

  async createLearningPathExport(
    sourceTenantId: UUIDType,
    sourceLearningPathId: UUIDType,
    targetTenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [createdExport] = await dbInstance
      .insert(learningPathExports)
      .values({
        sourceTenantId,
        sourceLearningPathId,
        targetTenantId,
        syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE,
      })
      .returning();

    return createdExport;
  }

  async getLearningPathExportsForManagingTenant(
    sourceTenantId: UUIDType,
    sourceLearningPathId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
      .select({
        id: learningPathExports.id,
        sourceTenantId: learningPathExports.sourceTenantId,
        sourceLearningPathId: learningPathExports.sourceLearningPathId,
        targetTenantId: learningPathExports.targetTenantId,
        targetLearningPathId: learningPathExports.targetLearningPathId,
        syncStatus: learningPathExports.syncStatus,
        lastSyncedAt: learningPathExports.lastSyncedAt,
      })
      .from(learningPathExports)
      .where(
        and(
          eq(learningPathExports.sourceTenantId, sourceTenantId),
          eq(learningPathExports.sourceLearningPathId, sourceLearningPathId),
        ),
      );
  }

  async getLearningPathExportCandidates(
    sourceTenantId: UUIDType,
    sourceLearningPathId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
      .select({
        id: tenants.id,
        name: tenants.name,
        host: tenants.host,
        exportId: learningPathExports.id,
        targetLearningPathId: learningPathExports.targetLearningPathId,
        syncStatus: learningPathExports.syncStatus,
        lastSyncedAt: learningPathExports.lastSyncedAt,
      })
      .from(tenants)
      .leftJoin(
        learningPathExports,
        and(
          eq(learningPathExports.sourceTenantId, sourceTenantId),
          eq(learningPathExports.sourceLearningPathId, sourceLearningPathId),
          eq(learningPathExports.targetTenantId, tenants.id),
        ),
      )
      .where(ne(tenants.id, sourceTenantId))
      .orderBy(asc(tenants.name));
  }

  async getCourseById(courseId: UUIDType, dbInstance: DatabasePg = this.db) {
    const [course] = await dbInstance
      .select({
        id: courses.id,
        title: courses.title,
        description: courses.description,
        thumbnailS3Key: courses.thumbnailS3Key,
        status: courses.status,
        hasCertificate: courses.hasCertificate,
        priceInCents: courses.priceInCents,
        currency: courses.currency,
        chapterCount: courses.chapterCount,
        isScorm: courses.isScorm,
        authorId: courses.authorId,
        categoryId: courses.categoryId,
        stripeProductId: courses.stripeProductId,
        stripePriceId: courses.stripePriceId,
        settings: courses.settings,
        baseLanguage: courses.baseLanguage,
        availableLocales: courses.availableLocales,
        originType: courses.originType,
        sourceCourseId: courses.sourceCourseId,
        sourceTenantId: courses.sourceTenantId,
        tenantId: courses.tenantId,
        createdAt: courses.createdAt,
        updatedAt: courses.updatedAt,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return course;
  }

  async findTargetAuthor(dbInstance: DatabasePg = this.db) {
    const [targetAuthor] = await dbInstance
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          userHasAnyPermissionsCondition(dbInstance, users.id, users.tenantId, [
            PERMISSIONS.LEARNING_PATH_MANAGE,
            PERMISSIONS.COURSE_UPDATE,
            PERMISSIONS.COURSE_UPDATE_OWN,
          ]),
        ),
      )
      .limit(1);

    return targetAuthor;
  }

  async markCourseAsMaster(courseId: UUIDType, dbInstance: DatabasePg = this.db) {
    await dbInstance
      .update(courses)
      .set({ originType: COURSE_ORIGIN_TYPES.MASTER })
      .where(eq(courses.id, courseId));
  }

  async findMasterCourseExportByPair(
    sourceTenantId: UUIDType,
    sourceCourseId: UUIDType,
    targetTenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [exportLink] = await dbInstance
      .select()
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceTenantId, sourceTenantId),
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
          eq(masterCourseExports.targetTenantId, targetTenantId),
        ),
      )
      .limit(1);

    return exportLink;
  }

  async createMasterCourseExportLink(
    sourceTenantId: UUIDType,
    sourceCourseId: UUIDType,
    targetTenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [createdExport] = await dbInstance
      .insert(masterCourseExports)
      .values({
        sourceTenantId,
        sourceCourseId,
        targetTenantId,
        syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE,
      })
      .returning();

    return createdExport;
  }

  async getActiveLearningPathExportsBySourcePath(
    sourceLearningPathId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
      .select()
      .from(learningPathExports)
      .where(
        and(
          eq(learningPathExports.sourceLearningPathId, sourceLearningPathId),
          eq(learningPathExports.syncStatus, MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE),
        ),
      );
  }

  async getLearningPathExportById(exportId: UUIDType, dbInstance: DatabasePg = this.db) {
    const [exportLink] = await dbInstance
      .select()
      .from(learningPathExports)
      .where(eq(learningPathExports.id, exportId))
      .limit(1);

    return exportLink;
  }

  async markLearningPathExportSyncSuccess(
    exportId: UUIDType,
    targetLearningPathId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    await dbInstance
      .update(learningPathExports)
      .set({
        targetLearningPathId,
        syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE,
        lastSyncedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(learningPathExports.id, exportId));
  }

  async markLearningPathExportSyncFailed(exportId: UUIDType, dbInstance: DatabasePg = this.db) {
    await dbInstance
      .update(learningPathExports)
      .set({ syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.FAILED })
      .where(eq(learningPathExports.id, exportId));
  }

  async upsertLearningPathEntityMap(
    exportId: UUIDType,
    entityType: LearningPathEntityType,
    sourceEntityId: UUIDType,
    targetEntityId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    await dbInstance
      .insert(learningPathEntityMap)
      .values({
        exportId,
        entityType,
        sourceEntityId,
        targetEntityId,
      })
      .onConflictDoUpdate({
        target: [
          learningPathEntityMap.exportId,
          learningPathEntityMap.entityType,
          learningPathEntityMap.sourceEntityId,
        ],
        set: { targetEntityId },
      });
  }

  async getLearningPathEntityMappings(
    exportId: UUIDType,
    entityType: LearningPathEntityType,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
      .select()
      .from(learningPathEntityMap)
      .where(
        and(
          eq(learningPathEntityMap.exportId, exportId),
          eq(learningPathEntityMap.entityType, entityType),
        ),
      );
  }

  async getCoursesByIds(courseIds: UUIDType[], dbInstance: DatabasePg = this.db) {
    return dbInstance
      .select({
        id: courses.id,
      })
      .from(courses)
      .where(inArray(courses.id, courseIds));
  }

  async getUsersByIds(userIds: UUIDType[], dbInstance: DatabasePg = this.db) {
    return dbInstance
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, userIds), sql`${users.deletedAt} IS NULL`));
  }

  async getNotEnrolledUserIds(
    pathId: UUIDType,
    userIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (userIds.length === 0) return [];

    const notEnrolledUsers = await dbInstance
      .select({ id: users.id })
      .from(users)
      .leftJoin(
        studentLearningPaths,
        and(
          eq(studentLearningPaths.studentId, users.id),
          eq(studentLearningPaths.learningPathId, pathId),
        ),
      )
      .where(
        and(
          inArray(users.id, userIds),
          sql`${users.deletedAt} IS NULL`,
          isNull(studentLearningPaths.id),
        ),
      );

    return notEnrolledUsers.map(({ id }) => id);
  }

  async getExistingGroupIds(groupIds: UUIDType[], dbInstance: DatabasePg = this.db) {
    if (groupIds.length === 0) return [];

    const existingGroups = await dbInstance
      .select({ id: groups.id })
      .from(groups)
      .where(inArray(groups.id, groupIds));

    return existingGroups.map(({ id }) => id);
  }

  async getStudentIdsByGroupIds(groupIds: UUIDType[], dbInstance: DatabasePg = this.db) {
    if (groupIds.length === 0) return [];

    const groupStudents = await dbInstance
      .selectDistinct({ studentId: groupUsers.userId })
      .from(groupUsers)
      .innerJoin(users, eq(users.id, groupUsers.userId))
      .where(and(inArray(groupUsers.groupId, groupIds), sql`${users.deletedAt} IS NULL`));

    return groupStudents.map(({ studentId }) => studentId);
  }

  async getNotEnrolledStudentIdsByGroupIds(
    pathId: UUIDType,
    groupIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (groupIds.length === 0) return [];

    const notEnrolledGroupStudents = await dbInstance
      .selectDistinct({ studentId: groupUsers.userId })
      .from(groupUsers)
      .innerJoin(users, eq(users.id, groupUsers.userId))
      .leftJoin(
        studentLearningPaths,
        and(
          eq(studentLearningPaths.studentId, groupUsers.userId),
          eq(studentLearningPaths.learningPathId, pathId),
        ),
      )
      .where(
        and(
          inArray(groupUsers.groupId, groupIds),
          sql`${users.deletedAt} IS NULL`,
          isNull(studentLearningPaths.id),
        ),
      );

    return notEnrolledGroupStudents.map(({ studentId }) => studentId);
  }

  async getDirectlyEnrolledStudentIdsWithGroupAccess(
    pathId: UUIDType,
    studentIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (studentIds.length === 0) return [];

    const studentGroupUsers = alias(groupUsers, "student_group_users");
    const studentGroupLearningPaths = alias(groupLearningPaths, "student_group_learning_paths");

    const directlyEnrolledStudentsWithGroupAccess = await dbInstance
      .selectDistinct({ studentId: studentLearningPaths.studentId })
      .from(studentLearningPaths)
      .innerJoin(studentGroupUsers, eq(studentGroupUsers.userId, studentLearningPaths.studentId))
      .innerJoin(
        studentGroupLearningPaths,
        eq(studentGroupLearningPaths.groupId, studentGroupUsers.groupId),
      )
      .innerJoin(users, eq(users.id, studentLearningPaths.studentId))
      .where(
        and(
          eq(studentLearningPaths.learningPathId, pathId),
          eq(studentGroupLearningPaths.learningPathId, pathId),
          eq(studentLearningPaths.enrollmentType, LEARNING_PATH_ENROLLMENT_TYPES.DIRECT),
          inArray(studentLearningPaths.studentId, studentIds),
          sql`${users.deletedAt} IS NULL`,
        ),
      );

    return directlyEnrolledStudentsWithGroupAccess.map(({ studentId }) => studentId);
  }

  async getDirectlyEnrolledStudentIdsWithoutGroupAccess(
    pathId: UUIDType,
    studentIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (studentIds.length === 0) return [];

    const studentGroupUsers = alias(groupUsers, "student_group_users");
    const studentGroupLearningPaths = alias(groupLearningPaths, "student_group_learning_paths");

    const directlyEnrolledStudentsWithoutGroupAccess = await dbInstance
      .select({ studentId: studentLearningPaths.studentId })
      .from(studentLearningPaths)
      .leftJoin(studentGroupUsers, eq(studentGroupUsers.userId, studentLearningPaths.studentId))
      .leftJoin(
        studentGroupLearningPaths,
        and(
          eq(studentGroupLearningPaths.groupId, studentGroupUsers.groupId),
          eq(studentGroupLearningPaths.learningPathId, pathId),
        ),
      )
      .where(
        and(
          eq(studentLearningPaths.learningPathId, pathId),
          eq(studentLearningPaths.enrollmentType, LEARNING_PATH_ENROLLMENT_TYPES.DIRECT),
          inArray(studentLearningPaths.studentId, studentIds),
        ),
      )
      .groupBy(studentLearningPaths.studentId)
      .having(sql`COUNT(${studentGroupLearningPaths.id}) = 0`);

    return directlyEnrolledStudentsWithoutGroupAccess.map(({ studentId }) => studentId);
  }

  async getGroupEnrolledStudentIdsWithoutOtherGroupAccess(
    pathId: UUIDType,
    groupIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (groupIds.length === 0) return [];

    const removedGroupUsers = alias(groupUsers, "removed_group_users");
    const removedGroupLearningPaths = alias(groupLearningPaths, "removed_group_learning_paths");
    const otherGroupUsers = alias(groupUsers, "other_group_users");
    const otherGroupLearningPaths = alias(groupLearningPaths, "other_group_learning_paths");

    const groupEnrolledStudentsWithoutOtherGroupAccess = await dbInstance
      .select({ studentId: studentLearningPaths.studentId })
      .from(studentLearningPaths)
      .innerJoin(removedGroupUsers, eq(removedGroupUsers.userId, studentLearningPaths.studentId))
      .innerJoin(
        removedGroupLearningPaths,
        and(
          eq(removedGroupLearningPaths.groupId, removedGroupUsers.groupId),
          eq(removedGroupLearningPaths.learningPathId, pathId),
        ),
      )
      .leftJoin(
        otherGroupUsers,
        and(
          eq(otherGroupUsers.userId, studentLearningPaths.studentId),
          not(inArray(otherGroupUsers.groupId, groupIds)),
        ),
      )
      .leftJoin(
        otherGroupLearningPaths,
        and(
          eq(otherGroupLearningPaths.groupId, otherGroupUsers.groupId),
          eq(otherGroupLearningPaths.learningPathId, pathId),
        ),
      )
      .where(
        and(
          eq(studentLearningPaths.learningPathId, pathId),
          eq(studentLearningPaths.enrollmentType, LEARNING_PATH_ENROLLMENT_TYPES.GROUP),
          inArray(removedGroupLearningPaths.groupId, groupIds),
        ),
      )
      .groupBy(studentLearningPaths.studentId)
      .having(sql`COUNT(${otherGroupLearningPaths.id}) = 0`);

    return groupEnrolledStudentsWithoutOtherGroupAccess.map(({ studentId }) => studentId);
  }

  async getEnrolledGroupIds(
    pathId: UUIDType,
    groupIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (groupIds.length === 0) return [];

    const enrolledGroups = await dbInstance
      .select({ groupId: groupLearningPaths.groupId })
      .from(groupLearningPaths)
      .where(
        and(
          eq(groupLearningPaths.learningPathId, pathId),
          inArray(groupLearningPaths.groupId, groupIds),
        ),
      );

    return enrolledGroups.map(({ groupId }) => groupId);
  }

  async insertGroupLearningPaths(
    pathId: UUIDType,
    groupIds: UUIDType[],
    tenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    if (groupIds.length === 0) return [];

    return dbInstance
      .insert(groupLearningPaths)
      .values(
        groupIds.map((groupId) => ({
          groupId,
          learningPathId: pathId,
          tenantId,
        })),
      )
      .onConflictDoNothing({
        target: [groupLearningPaths.groupId, groupLearningPaths.learningPathId],
      })
      .returning();
  }

  async insertStudentLearningPaths(
    pathId: UUIDType,
    studentIds: UUIDType[],
    enrollmentType: LearningPathEnrollmentType,
    tenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    if (studentIds.length === 0) return [];

    return dbInstance
      .insert(studentLearningPaths)
      .values(
        studentIds.map((studentId) => ({
          studentId,
          learningPathId: pathId,
          enrollmentType,
          tenantId,
        })),
      )
      .onConflictDoNothing({
        target: [studentLearningPaths.studentId, studentLearningPaths.learningPathId],
      })
      .returning();
  }

  async updateStudentLearningPathEnrollmentType(
    pathId: UUIDType,
    studentIds: UUIDType[],
    enrollmentType: LearningPathEnrollmentType,
    dbInstance: DatabasePg = this.db,
  ) {
    if (studentIds.length === 0) return [];

    return dbInstance
      .update(studentLearningPaths)
      .set({ enrollmentType })
      .where(
        and(
          eq(studentLearningPaths.learningPathId, pathId),
          inArray(studentLearningPaths.studentId, studentIds),
        ),
      )
      .returning({ studentId: studentLearningPaths.studentId });
  }

  async deleteStudentLearningPaths(
    pathId: UUIDType,
    studentIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (studentIds.length === 0) return [];

    return dbInstance
      .delete(studentLearningPaths)
      .where(
        and(
          eq(studentLearningPaths.learningPathId, pathId),
          inArray(studentLearningPaths.studentId, studentIds),
        ),
      )
      .returning({ studentId: studentLearningPaths.studentId });
  }

  async insertStudentLearningPathCourses(
    pathId: UUIDType,
    studentIds: UUIDType[],
    courseIds: UUIDType[],
    tenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    if (studentIds.length === 0 || courseIds.length === 0) return [];

    return dbInstance
      .insert(studentLearningPathCourses)
      .values(
        studentIds.flatMap((studentId) =>
          courseIds.map((courseId) => ({
            studentId,
            learningPathId: pathId,
            courseId,
            tenantId,
          })),
        ),
      )
      .onConflictDoNothing({
        target: [
          studentLearningPathCourses.studentId,
          studentLearningPathCourses.learningPathId,
          studentLearningPathCourses.courseId,
        ],
      })
      .returning();
  }

  async deleteStudentLearningPathCourses(
    pathId: UUIDType,
    studentIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (studentIds.length === 0) return [];

    return dbInstance
      .delete(studentLearningPathCourses)
      .where(
        and(
          eq(studentLearningPathCourses.learningPathId, pathId),
          inArray(studentLearningPathCourses.studentId, studentIds),
        ),
      )
      .returning({ studentId: studentLearningPathCourses.studentId });
  }

  async getStudentLearningPathCourseLinks(
    pathId: UUIDType,
    studentId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
      .select({
        courseId: studentLearningPathCourses.courseId,
        createdAt: studentLearningPathCourses.createdAt,
      })
      .from(studentLearningPathCourses)
      .where(
        and(
          eq(studentLearningPathCourses.learningPathId, pathId),
          eq(studentLearningPathCourses.studentId, studentId),
        ),
      );
  }

  async insertStudentLearningPathCourseLinks(
    pathId: UUIDType,
    studentId: UUIDType,
    courseIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (courseIds.length === 0) return [];

    return dbInstance
      .insert(studentLearningPathCourses)
      .values(
        courseIds.map((courseId) => ({
          studentId,
          learningPathId: pathId,
          courseId,
        })),
      )
      .onConflictDoNothing({
        target: [
          studentLearningPathCourses.studentId,
          studentLearningPathCourses.learningPathId,
          studentLearningPathCourses.courseId,
        ],
      })
      .returning({
        courseId: studentLearningPathCourses.courseId,
        createdAt: studentLearningPathCourses.createdAt,
      });
  }

  async deleteStudentLearningPathCourseLinks(
    pathId: UUIDType,
    studentId: UUIDType,
    courseIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (courseIds.length === 0) return [];

    return dbInstance
      .delete(studentLearningPathCourses)
      .where(
        and(
          eq(studentLearningPathCourses.learningPathId, pathId),
          eq(studentLearningPathCourses.studentId, studentId),
          inArray(studentLearningPathCourses.courseId, courseIds),
        ),
      )
      .returning({
        courseId: studentLearningPathCourses.courseId,
        createdAt: studentLearningPathCourses.createdAt,
      });
  }

  async getCourseIdsWithOtherLearningPathAccess(
    learningPathId: UUIDType,
    studentId: UUIDType,
    courseIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (courseIds.length === 0) return [];

    const rows = await dbInstance
      .selectDistinct({ courseId: studentLearningPathCourses.courseId })
      .from(studentLearningPathCourses)
      .where(
        and(
          eq(studentLearningPathCourses.studentId, studentId),
          inArray(studentLearningPathCourses.courseId, courseIds),
          sql`${studentLearningPathCourses.learningPathId} <> ${learningPathId}`,
        ),
      );

    return rows.map(({ courseId }) => courseId);
  }

  async deleteGroupLearningPaths(
    pathId: UUIDType,
    groupIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (groupIds.length === 0) return [];

    return dbInstance
      .delete(groupLearningPaths)
      .where(
        and(
          eq(groupLearningPaths.learningPathId, pathId),
          inArray(groupLearningPaths.groupId, groupIds),
        ),
      )
      .returning({ groupId: groupLearningPaths.groupId });
  }

  async getMaxDisplayOrder(pathId: UUIDType, dbInstance: DatabasePg = this.db) {
    const [result] = await dbInstance
      .select({
        maxDisplayOrder: sql<number>`COALESCE(MAX(${learningPathCourses.displayOrder}), 0)`,
      })
      .from(learningPathCourses)
      .where(eq(learningPathCourses.learningPathId, pathId));

    return result?.maxDisplayOrder ?? 0;
  }

  async insertLearningPathCourses(
    pathId: UUIDType,
    courseIds: UUIDType[],
    startOrder: number,
    tenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    if (courseIds.length === 0) return [];

    return dbInstance
      .insert(learningPathCourses)
      .values(
        courseIds.map((courseId, index) => ({
          learningPathId: pathId,
          courseId,
          displayOrder: startOrder + index + 1,
          tenantId,
        })),
      )
      .returning({
        id: learningPathCourses.id,
        learningPathId: learningPathCourses.learningPathId,
        courseId: learningPathCourses.courseId,
        displayOrder: learningPathCourses.displayOrder,
        createdAt: learningPathCourses.createdAt,
        updatedAt: learningPathCourses.updatedAt,
      });
  }

  async removeLearningPathCourse(
    pathId: UUIDType,
    courseId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [deletedCourse] = await dbInstance
      .delete(learningPathCourses)
      .where(
        and(
          eq(learningPathCourses.learningPathId, pathId),
          eq(learningPathCourses.courseId, courseId),
        ),
      )
      .returning({
        id: learningPathCourses.id,
        displayOrder: learningPathCourses.displayOrder,
      });

    return deletedCourse;
  }

  async shiftCoursesAfterRemoval(
    pathId: UUIDType,
    removedDisplayOrder: number,
    dbInstance: DatabasePg = this.db,
  ) {
    await dbInstance
      .update(learningPathCourses)
      .set({
        displayOrder: sql`${learningPathCourses.displayOrder} - 1`,
      })
      .where(
        and(
          eq(learningPathCourses.learningPathId, pathId),
          sql`${learningPathCourses.displayOrder} > ${removedDisplayOrder}`,
        ),
      );
  }

  async temporarilyOffsetDisplayOrder(
    pathId: UUIDType,
    offset: number,
    dbInstance: DatabasePg = this.db,
  ) {
    await dbInstance
      .update(learningPathCourses)
      .set({
        displayOrder: sql`${learningPathCourses.displayOrder} + ${offset}`,
      })
      .where(eq(learningPathCourses.learningPathId, pathId));
  }

  async setDisplayOrder(
    pathId: UUIDType,
    courseId: UUIDType,
    displayOrder: number,
    dbInstance: DatabasePg = this.db,
  ) {
    await dbInstance
      .update(learningPathCourses)
      .set({ displayOrder })
      .where(
        and(
          eq(learningPathCourses.learningPathId, pathId),
          eq(learningPathCourses.courseId, courseId),
        ),
      );
  }

  async getTargetLearningPathBySourceId(
    sourceTenantId: UUIDType,
    sourceLearningPathId: UUIDType,
    targetTenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [exportLink] = await dbInstance
      .select({
        id: learningPathExports.targetLearningPathId,
      })
      .from(learningPathExports)
      .where(
        and(
          eq(learningPathExports.sourceTenantId, sourceTenantId),
          eq(learningPathExports.sourceLearningPathId, sourceLearningPathId),
          eq(learningPathExports.targetTenantId, targetTenantId),
        ),
      )
      .limit(1);

    if (!exportLink?.id) return null;

    return this.findLearningPathById(exportLink.id, dbInstance);
  }

  async createTargetLearningPath(
    values: typeof learningPaths.$inferInsert,
    dbInstance: DatabasePg = this.db,
  ) {
    const [createdLearningPath] = await dbInstance.insert(learningPaths).values(values).returning();

    return createdLearningPath;
  }

  async updateTargetLearningPath(
    pathId: UUIDType,
    updates: Partial<typeof learningPaths.$inferInsert>,
    dbInstance: DatabasePg = this.db,
  ) {
    const [updatedLearningPath] = await dbInstance
      .update(learningPaths)
      .set(updates)
      .where(eq(learningPaths.id, pathId))
      .returning();

    return updatedLearningPath;
  }

  async deleteLearningPathCoursesByPathId(pathId: UUIDType, dbInstance: DatabasePg = this.db) {
    await dbInstance
      .delete(learningPathCourses)
      .where(eq(learningPathCourses.learningPathId, pathId));
  }

  async deleteStudentLearningPathCourseLinksByPathId(
    pathId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    await dbInstance
      .delete(studentLearningPathCourses)
      .where(eq(studentLearningPathCourses.learningPathId, pathId));
  }

  async getStudentLearningPathEnrollment(
    pathId: UUIDType,
    studentId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance.query.studentLearningPaths.findFirst({
      where: and(
        eq(studentLearningPaths.learningPathId, pathId),
        eq(studentLearningPaths.studentId, studentId),
      ),
    });
  }

  async getStudentCourseProgressByCourseIds(
    studentId: UUIDType,
    courseIds: UUIDType[],
    dbInstance: DatabasePg = this.db,
  ): Promise<LearningPathCourseProgressRow[]> {
    if (courseIds.length === 0) return [];

    return dbInstance
      .select({
        courseId: studentCourses.courseId,
        progress: sql<ProgressStatus>`${studentCourses.progress}`,
        completedAt: studentCourses.completedAt,
      })
      .from(studentCourses)
      .where(
        and(eq(studentCourses.studentId, studentId), inArray(studentCourses.courseId, courseIds)),
      );
  }

  async updateStudentLearningPathProgress(
    pathId: UUIDType,
    studentId: UUIDType,
    progress: LearningPathProgressStatus,
    completedAt: string | null,
    dbInstance: DatabasePg = this.db,
  ) {
    return dbInstance
      .update(studentLearningPaths)
      .set({ progress, completedAt })
      .where(
        and(
          eq(studentLearningPaths.learningPathId, pathId),
          eq(studentLearningPaths.studentId, studentId),
        ),
      )
      .returning({ studentId: studentLearningPaths.studentId });
  }

  async getLearningPathProgressState(
    pathId: UUIDType,
    studentId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ): Promise<LearningPathProgressState> {
    const [courses, enrollment] = await Promise.all([
      this.getLearningPathCourses(pathId, dbInstance),
      this.getStudentLearningPathEnrollment(pathId, studentId, dbInstance),
    ]);

    const studentCourseProgressRows = await this.getStudentCourseProgressByCourseIds(
      studentId,
      courses.map(({ courseId }) => courseId),
      dbInstance,
    );

    return {
      courses,
      studentCourseProgressRows,
      isEnrolled: Boolean(enrollment),
    };
  }

  async findLearningPathCertificateByUserAndPath(
    userId: UUIDType,
    learningPathId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [certificate] = await dbInstance
      .select({ ...getTableColumns(learningPathCertificates) })
      .from(learningPathCertificates)
      .where(
        and(
          eq(learningPathCertificates.userId, userId),
          eq(learningPathCertificates.learningPathId, learningPathId),
        ),
      )
      .limit(1);

    return certificate;
  }

  async findLearningPathCertificateById(
    userId: UUIDType,
    certificateId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [certificate] = await dbInstance
      .select({ ...getTableColumns(learningPathCertificates) })
      .from(learningPathCertificates)
      .where(
        and(
          eq(learningPathCertificates.id, certificateId),
          eq(learningPathCertificates.userId, userId),
        ),
      )
      .limit(1);

    return certificate;
  }

  async findLearningPathCertificateByIdForRender(
    userId: UUIDType,
    certificateId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [certificate] = await dbInstance
      .select({
        ...getTableColumns(learningPathCertificates),
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        pathTitle: learningPaths.title,
      })
      .from(learningPathCertificates)
      .innerJoin(users, eq(users.id, learningPathCertificates.userId))
      .innerJoin(learningPaths, eq(learningPaths.id, learningPathCertificates.learningPathId))
      .where(
        and(
          eq(learningPathCertificates.id, certificateId),
          eq(learningPathCertificates.userId, userId),
        ),
      )
      .limit(1);

    return certificate;
  }

  async findPublicLearningPathCertificateById(
    certificateId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [certificate] = await dbInstance
      .select({
        ...getTableColumns(learningPathCertificates),
        tenantHost: tenants.host,
        tenantName: tenants.name,
        fullName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        pathTitle: learningPaths.title,
      })
      .from(learningPathCertificates)
      .innerJoin(users, eq(users.id, learningPathCertificates.userId))
      .innerJoin(learningPaths, eq(learningPaths.id, learningPathCertificates.learningPathId))
      .innerJoin(tenants, eq(tenants.id, learningPathCertificates.tenantId))
      .where(eq(learningPathCertificates.id, certificateId))
      .limit(1);

    return certificate;
  }

  async createLearningPathCertificate(
    userId: UUIDType,
    learningPathId: UUIDType,
    tenantId: UUIDType,
    dbInstance: DatabasePg = this.db,
  ) {
    const [certificate] = await dbInstance
      .insert(learningPathCertificates)
      .values({
        userId,
        learningPathId,
        tenantId,
        status: LEARNING_PATH_CERTIFICATE_STATUSES.ACTIVE,
      })
      .onConflictDoNothing({
        target: [learningPathCertificates.userId, learningPathCertificates.learningPathId],
      })
      .returning();

    return certificate;
  }
}
