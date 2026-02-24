import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  COURSE_ORIGIN_TYPES,
  ENTITY_TYPES,
  MASTER_COURSE_EXPORT_SYNC_STATUSES,
  type MasterCourseEntityType,
} from "@repo/shared";
import { and, asc, eq, getTableColumns, inArray, ne, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  aiMentorLessons,
  categories,
  chapters,
  courses,
  coursesSummaryStats,
  lessons,
  masterCourseEntityMap,
  masterCourseExports,
  questionAnswerOptions,
  questions,
  resourceEntity,
  resources,
  tenants,
  users,
} from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type {
  AiMentorLessonInsert,
  ChapterInsert,
  CourseInsert,
  LessonInsert,
  MasterCourseExportRecord,
  QuestionAnswerOptionInsert,
  QuestionInsert,
  ResourceEntityInsert,
  ResourceInsert,
  SourceSnapshot,
} from "src/courses/types/master-course.types";

@Injectable()
export class MasterCourseRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async getCourseById(courseId: UUIDType) {
    const [course] = await this.db
      .select({ ...getTableColumns(courses) })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return course;
  }

  async markCourseAsMaster(courseId: UUIDType) {
    await this.db
      .update(courses)
      .set({ originType: COURSE_ORIGIN_TYPES.MASTER })
      .where(eq(courses.id, courseId));
  }

  async getTenantManagingStatus(tenantId: UUIDType) {
    const [tenant] = await this.dbAdmin
      .select({ isManaging: tenants.isManaging })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant;
  }

  async findExportLinkByPair(
    sourceTenantId: UUIDType,
    sourceCourseId: UUIDType,
    targetTenantId: UUIDType,
  ) {
    const [exportLink] = await this.dbAdmin
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

  async createExportLink(
    sourceTenantId: UUIDType,
    sourceCourseId: UUIDType,
    targetTenantId: UUIDType,
  ) {
    const [createdExport] = await this.dbAdmin
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

  async getCourseExportsForManagingTenant(sourceTenantId: UUIDType, sourceCourseId: UUIDType) {
    return this.dbAdmin
      .select({
        id: masterCourseExports.id,
        sourceTenantId: masterCourseExports.sourceTenantId,
        sourceCourseId: masterCourseExports.sourceCourseId,
        targetTenantId: masterCourseExports.targetTenantId,
        targetCourseId: masterCourseExports.targetCourseId,
        syncStatus: masterCourseExports.syncStatus,
        lastSyncedAt: masterCourseExports.lastSyncedAt,
      })
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceTenantId, sourceTenantId),
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
        ),
      );
  }

  async getExportCandidatesForCourse(sourceTenantId: UUIDType, sourceCourseId: UUIDType) {
    return this.dbAdmin
      .select({
        id: tenants.id,
        name: tenants.name,
        host: tenants.host,
        exportId: masterCourseExports.id,
        targetCourseId: masterCourseExports.targetCourseId,
        syncStatus: masterCourseExports.syncStatus,
        lastSyncedAt: masterCourseExports.lastSyncedAt,
      })
      .from(tenants)
      .leftJoin(
        masterCourseExports,
        and(
          eq(masterCourseExports.sourceTenantId, sourceTenantId),
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
          eq(masterCourseExports.targetTenantId, tenants.id),
        ),
      )
      .where(ne(tenants.id, sourceTenantId))
      .orderBy(asc(tenants.name));
  }

  async getActiveExportLinksBySourceCourse(sourceCourseId: UUIDType) {
    return this.dbAdmin
      .select()
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
          eq(masterCourseExports.syncStatus, MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE),
        ),
      );
  }

  async getExportLinkById(exportId: UUIDType): Promise<MasterCourseExportRecord> {
    const [exportLink] = await this.dbAdmin
      .select()
      .from(masterCourseExports)
      .where(eq(masterCourseExports.id, exportId))
      .limit(1);

    if (!exportLink) {
      throw new NotFoundException("masterCourse.error.exportLinkMissing");
    }

    return exportLink;
  }

  async updateExportTargetCourse(exportId: UUIDType, targetCourseId: UUIDType) {
    await this.dbAdmin
      .update(masterCourseExports)
      .set({ targetCourseId })
      .where(eq(masterCourseExports.id, exportId));
  }

  async markExportSyncSuccess(exportId: UUIDType, targetCourseId: UUIDType) {
    await this.dbAdmin
      .update(masterCourseExports)
      .set({
        targetCourseId,
        syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE,
        lastSyncedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(masterCourseExports.id, exportId));
  }

  async markExportSyncFailed(exportId: UUIDType) {
    await this.dbAdmin
      .update(masterCourseExports)
      .set({ syncStatus: MASTER_COURSE_EXPORT_SYNC_STATUSES.FAILED })
      .where(eq(masterCourseExports.id, exportId));
  }

  async getMappedTargetEntityId(
    exportId: UUIDType,
    entityType: MasterCourseEntityType,
    sourceEntityId: UUIDType,
  ) {
    const [existing] = await this.dbAdmin
      .select({ targetEntityId: masterCourseEntityMap.targetEntityId })
      .from(masterCourseEntityMap)
      .where(
        and(
          eq(masterCourseEntityMap.exportId, exportId),
          eq(masterCourseEntityMap.entityType, entityType),
          eq(masterCourseEntityMap.sourceEntityId, sourceEntityId),
        ),
      )
      .limit(1);

    return existing?.targetEntityId;
  }

  async upsertMap(
    exportId: UUIDType,
    entityType: MasterCourseEntityType,
    sourceEntityId: UUIDType,
    targetEntityId: UUIDType,
  ) {
    await this.dbAdmin
      .insert(masterCourseEntityMap)
      .values({
        exportId,
        entityType,
        sourceEntityId,
        targetEntityId,
      })
      .onConflictDoUpdate({
        target: [
          masterCourseEntityMap.exportId,
          masterCourseEntityMap.entityType,
          masterCourseEntityMap.sourceEntityId,
        ],
        set: { targetEntityId },
      });
  }

  async getMappings(exportId: UUIDType, entityType: MasterCourseEntityType) {
    return this.dbAdmin
      .select()
      .from(masterCourseEntityMap)
      .where(
        and(
          eq(masterCourseEntityMap.exportId, exportId),
          eq(masterCourseEntityMap.entityType, entityType),
        ),
      );
  }

  async deleteMappingsByIds(mapIds: UUIDType[]) {
    if (!mapIds.length) return;

    await this.dbAdmin
      .delete(masterCourseEntityMap)
      .where(inArray(masterCourseEntityMap.id, mapIds));
  }

  async deleteMappedEntities(
    targetTable: typeof chapters | typeof lessons | typeof questions | typeof questionAnswerOptions,
    targetIds: UUIDType[],
  ) {
    if (!targetIds.length) return;

    await this.db.delete(targetTable).where(inArray((targetTable as any).id, targetIds));
  }

  async getSourceSnapshot(sourceCourseId: UUIDType): Promise<SourceSnapshot> {
    const [sourceCourse] = await this.db
      .select()
      .from(courses)
      .where(eq(courses.id, sourceCourseId))
      .limit(1);

    if (!sourceCourse) throw new NotFoundException("Course not found");

    const [sourceCategory] = await this.db
      .select({ id: categories.id, title: categories.title })
      .from(categories)
      .where(eq(categories.id, sourceCourse.categoryId))
      .limit(1);

    const chapterRows = await this.db
      .select(getTableColumns(chapters))
      .from(chapters)
      .where(eq(chapters.courseId, sourceCourse.id))
      .orderBy(chapters.displayOrder);

    const lessonRows = await this.db
      .select(getTableColumns(lessons))
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .where(eq(chapters.courseId, sourceCourse.id))
      .orderBy(lessons.displayOrder);

    const lessonIds = lessonRows.map((row) => row.id);
    const questionRows = lessonIds.length
      ? await this.db
          .select(getTableColumns(questions))
          .from(questions)
          .where(inArray(questions.lessonId, lessonIds))
          .orderBy(questions.displayOrder)
      : [];

    const questionIds = questionRows.map((row) => row.id);
    const optionRows = questionIds.length
      ? await this.db
          .select(getTableColumns(questionAnswerOptions))
          .from(questionAnswerOptions)
          .where(inArray(questionAnswerOptions.questionId, questionIds))
          .orderBy(questionAnswerOptions.displayOrder)
      : [];

    const aiMentorRows = lessonIds.length
      ? await this.db
          .select(getTableColumns(aiMentorLessons))
          .from(aiMentorLessons)
          .where(inArray(aiMentorLessons.lessonId, lessonIds))
      : [];

    const lessonResourceRows = lessonIds.length
      ? await this.db
          .select({
            resource: getTableColumns(resources),
            relation: getTableColumns(resourceEntity),
          })
          .from(resourceEntity)
          .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
          .where(
            and(
              eq(resourceEntity.entityType, ENTITY_TYPES.LESSON),
              inArray(resourceEntity.entityId, lessonIds),
              eq(resources.archived, false),
            ),
          )
      : [];

    const courseResourceRows = await this.db
      .select({
        resource: getTableColumns(resources),
        relation: getTableColumns(resourceEntity),
      })
      .from(resourceEntity)
      .innerJoin(resources, eq(resources.id, resourceEntity.resourceId))
      .where(
        and(
          eq(resourceEntity.entityType, ENTITY_TYPES.COURSE),
          eq(resourceEntity.entityId, sourceCourse.id),
          eq(resources.archived, false),
        ),
      );

    return {
      course: sourceCourse,
      categoryTitle: sourceCategory?.title ?? "General",
      chapters: chapterRows,
      lessons: lessonRows,
      questions: questionRows,
      options: optionRows,
      aiMentors: aiMentorRows,
      lessonResources: lessonResourceRows,
      courseResources: courseResourceRows,
    };
  }

  async findTargetAuthor() {
    const [targetAuthor] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.role, [USER_ROLES.ADMIN, USER_ROLES.CONTENT_CREATOR]))
      .limit(1);

    return targetAuthor;
  }

  async findCategoryByTitle(title: string) {
    const [existingCategory] = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.title, title))
      .limit(1);

    return existingCategory;
  }

  async createCategory(title: string) {
    const [createdCategory] = await this.db
      .insert(categories)
      .values({ title })
      .returning({ id: categories.id });

    return createdCategory;
  }

  async findCourseByIdInTenant(courseId: UUIDType | null | undefined) {
    if (!courseId) return undefined;

    const [existingCourse] = await this.db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    return existingCourse;
  }

  async ensureCourseSummaryStats(courseId: UUIDType, authorId: UUIDType) {
    await this.db.insert(coursesSummaryStats).values({ courseId, authorId }).onConflictDoNothing();
  }

  async createTargetCourse(values: CourseInsert): Promise<UUIDType> {
    const [createdCourse] = await this.db
      .insert(courses)
      .values(values)
      .returning({ id: courses.id });
    return createdCourse.id;
  }

  async updateTargetCourse(courseId: UUIDType, values: Partial<CourseInsert>): Promise<void> {
    await this.db.update(courses).set(values).where(eq(courses.id, courseId));
  }

  async updateTargetCourseChapterCount(courseId: UUIDType, chapterCount: number): Promise<void> {
    await this.db.update(courses).set({ chapterCount }).where(eq(courses.id, courseId));
  }

  async createTargetChapter(values: ChapterInsert): Promise<UUIDType> {
    const [created] = await this.db.insert(chapters).values(values).returning({ id: chapters.id });
    return created.id;
  }

  async updateTargetChapter(chapterId: UUIDType, values: Partial<ChapterInsert>) {
    await this.db.update(chapters).set(values).where(eq(chapters.id, chapterId));
  }

  async createTargetLesson(values: LessonInsert): Promise<UUIDType> {
    const [created] = await this.db.insert(lessons).values(values).returning({ id: lessons.id });
    return created.id;
  }

  async updateTargetLesson(lessonId: UUIDType, values: Partial<LessonInsert>) {
    await this.db.update(lessons).set(values).where(eq(lessons.id, lessonId));
  }

  async createTargetQuestion(values: QuestionInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(questions)
      .values(values)
      .returning({ id: questions.id });
    return created.id;
  }

  async updateTargetQuestion(questionId: UUIDType, values: Partial<QuestionInsert>) {
    await this.db.update(questions).set(values).where(eq(questions.id, questionId));
  }

  async createTargetOption(values: QuestionAnswerOptionInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(questionAnswerOptions)
      .values(values)
      .returning({ id: questionAnswerOptions.id });
    return created.id;
  }

  async updateTargetOption(optionId: UUIDType, values: Partial<QuestionAnswerOptionInsert>) {
    await this.db
      .update(questionAnswerOptions)
      .set(values)
      .where(eq(questionAnswerOptions.id, optionId));
  }

  async findAiMentorByLessonId(lessonId: UUIDType) {
    const [existingAiMentor] = await this.db
      .select({ id: aiMentorLessons.id })
      .from(aiMentorLessons)
      .where(eq(aiMentorLessons.lessonId, lessonId))
      .limit(1);

    return existingAiMentor;
  }

  async createAiMentor(values: AiMentorLessonInsert) {
    await this.db.insert(aiMentorLessons).values(values);
  }

  async updateAiMentor(aiMentorId: UUIDType, values: Partial<AiMentorLessonInsert>) {
    await this.db.update(aiMentorLessons).set(values).where(eq(aiMentorLessons.id, aiMentorId));
  }

  async removeLessonResourceRelations(lessonIds: UUIDType[]) {
    if (!lessonIds.length) return;

    await this.db
      .delete(resourceEntity)
      .where(
        and(
          eq(resourceEntity.entityType, ENTITY_TYPES.LESSON),
          inArray(resourceEntity.entityId, lessonIds),
        ),
      );
  }

  async removeCourseResourceRelations(courseId: UUIDType) {
    await this.db
      .delete(resourceEntity)
      .where(
        and(
          eq(resourceEntity.entityType, ENTITY_TYPES.COURSE),
          eq(resourceEntity.entityId, courseId),
        ),
      );
  }

  async createResource(values: ResourceInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(resources)
      .values(values)
      .returning({ id: resources.id });
    return created.id;
  }

  async createResourceRelation(values: ResourceEntityInsert) {
    await this.db.insert(resourceEntity).values(values);
  }
}
