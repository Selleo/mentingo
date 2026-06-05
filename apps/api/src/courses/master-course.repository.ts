import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  COURSE_ORIGIN_TYPES,
  ENTITY_TYPES,
  LESSON_TYPES,
  MASTER_COURSE_EXPORT_SYNC_STATUSES,
  PERMISSIONS,
  SCORM_PACKAGE_ENTITY_TYPE,
  type MasterCourseEntityType,
  type SupportedLanguages,
} from "@repo/shared";
import { and, asc, eq, getTableColumns, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { userHasAnyPermissionsCondition } from "src/common/permissions/permission-sql.utils";
import { LocalizationService } from "src/localization/localization.service";
import {
  extractResourceIdsFromRichText,
  getLocalizedRichTextEntries,
} from "src/resource-library/resource-library.utils";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  aiMentorLessons,
  categories,
  chapters,
  courses,
  coursesSummaryStats,
  docChunks,
  documents,
  documentToAiMentorLesson,
  lessons,
  masterCourseEntityMap,
  masterCourseExports,
  questionAnswerOptions,
  questions,
  resourceEntity,
  resources,
  scormPackages,
  scormScos,
  tenants,
  users,
} from "src/storage/schema";

import type {
  AiMentorLessonInsert,
  CategoryJsonbInsert,
  CategoryJsonbUpdate,
  CourseSelect,
  ChapterJsonbInsert,
  ChapterJsonbUpdate,
  CourseJsonbInsert,
  CourseJsonbUpdate,
  DocChunkInsert,
  DocumentInsert,
  DocumentToAiMentorLessonInsert,
  LessonJsonbInsert,
  LessonJsonbUpdate,
  MasterCourseExportRecord,
  QuestionAnswerOptionJsonbInsert,
  QuestionAnswerOptionJsonbUpdate,
  QuestionJsonbInsert,
  QuestionJsonbUpdate,
  ResourceEntityInsert,
  ResourceInsert,
  ScormPackageInsert,
  ScormScoInsert,
  SourceSnapshot,
} from "src/courses/types/master-course.types";

@Injectable()
export class MasterCourseRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly localizationService: LocalizationService,
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

  async getTenantHost(tenantId: UUIDType) {
    const [tenant] = await this.dbAdmin
      .select({ host: tenants.host })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant?.host;
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
          ne(masterCourseExports.syncStatus, MASTER_COURSE_EXPORT_SYNC_STATUSES.PAUSED),
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

  async getSourceSnapshot(sourceCourse: CourseSelect): Promise<SourceSnapshot | null> {
    const [sourceCategoryRow] = await this.db
      .select({
        ...getTableColumns(categories),
        baseTitle: this.localizationService.getLocalizedSqlField(
          categories.title,
          sourceCourse.baseLanguage,
          categories,
        ),
      })
      .from(categories)
      .where(eq(categories.id, sourceCourse.categoryId))
      .limit(1);

    if (!sourceCategoryRow) return null;

    const { baseTitle, ...sourceCategory } = sourceCategoryRow;

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
    const aiMentorIds = aiMentorRows.map((row) => row.id);
    const aiMentorDocumentLinkRows = aiMentorIds.length
      ? await this.db
          .select(getTableColumns(documentToAiMentorLesson))
          .from(documentToAiMentorLesson)
          .where(inArray(documentToAiMentorLesson.aiMentorLessonId, aiMentorIds))
      : [];
    const aiMentorDocumentIds = aiMentorDocumentLinkRows.map((row) => row.documentId);
    const aiMentorDocumentRows = aiMentorDocumentIds.length
      ? await this.db
          .select(getTableColumns(documents))
          .from(documents)
          .where(inArray(documents.id, aiMentorDocumentIds))
      : [];
    const aiMentorDocChunkRows = aiMentorDocumentIds.length
      ? await this.db
          .select(getTableColumns(docChunks))
          .from(docChunks)
          .where(inArray(docChunks.documentId, aiMentorDocumentIds))
          .orderBy(docChunks.documentId, docChunks.chunkIndex)
      : [];
    const scormLessonIds = lessonRows
      .filter((lesson) => lesson.type === LESSON_TYPES.SCORM)
      .map((lesson) => lesson.id);
    const scormPackageRows = scormLessonIds.length
      ? await this.db
          .selectDistinct(getTableColumns(scormPackages))
          .from(scormPackages)
          .innerJoin(scormScos, eq(scormScos.packageId, scormPackages.id))
          .where(
            and(
              inArray(scormScos.lessonId, scormLessonIds),
              sql`(
                (${scormPackages.entityType} = ${SCORM_PACKAGE_ENTITY_TYPE.LESSON} AND ${scormPackages.entityId} = ${scormScos.lessonId})
                OR (${scormPackages.entityType} = ${SCORM_PACKAGE_ENTITY_TYPE.COURSE} AND ${scormPackages.entityId} = ${sourceCourse.id})
              )`,
            ),
          )
      : [];
    const scormPackageIds = scormPackageRows.map((row) => row.id);
    const scormScoRows = scormPackageIds.length
      ? await this.db
          .select(getTableColumns(scormScos))
          .from(scormScos)
          .where(
            and(
              inArray(scormScos.packageId, scormPackageIds),
              inArray(scormScos.lessonId, scormLessonIds),
            ),
          )
          .orderBy(scormScos.packageId, scormScos.displayOrder)
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
    const lessonContentResourceIds = [
      ...new Set(
        lessonRows.flatMap((lesson) =>
          getLocalizedRichTextEntries(lesson.description).flatMap(([, content]) =>
            extractResourceIdsFromRichText(content),
          ),
        ),
      ),
    ];
    const lessonContentResourceRows = lessonContentResourceIds.length
      ? await this.db
          .select(getTableColumns(resources))
          .from(resources)
          .where(
            and(inArray(resources.id, lessonContentResourceIds), eq(resources.archived, false)),
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
      category: sourceCategory,
      categoryBaseTitle: baseTitle,
      chapters: chapterRows,
      lessons: lessonRows,
      questions: questionRows,
      options: optionRows,
      aiMentors: aiMentorRows,
      aiMentorDocumentLinks: aiMentorDocumentLinkRows,
      aiMentorDocuments: aiMentorDocumentRows,
      aiMentorDocChunks: aiMentorDocChunkRows,
      scormPackages: scormPackageRows,
      scormScos: scormScoRows,
      lessonContentResources: lessonContentResourceRows,
      lessonResources: lessonResourceRows,
      courseResources: courseResourceRows,
    };
  }

  async findTargetAuthor() {
    const [targetAuthor] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          userHasAnyPermissionsCondition(this.db, users.id, users.tenantId, [
            PERMISSIONS.COURSE_UPDATE,
            PERMISSIONS.COURSE_UPDATE_OWN,
          ]),
        ),
      )
      .limit(1);

    return targetAuthor;
  }

  async findCategoryByBaseTitle(title: string, baseLanguage: SupportedLanguages) {
    const [existingCategory] = await this.db
      .select(getTableColumns(categories))
      .from(categories)
      .where(sql`COALESCE(${categories.title}::jsonb ->> ${baseLanguage}, '') = ${title}`)
      .limit(1);

    return existingCategory;
  }

  async createCategoryFromSource(
    values: Pick<CategoryJsonbInsert, "title" | "baseLanguage" | "availableLocales">,
  ) {
    const [createdCategory] = await this.db
      .insert(categories)
      .values({
        title: values.title,
        baseLanguage: values.baseLanguage,
        availableLocales: values.availableLocales,
        archived: false,
      })
      .onConflictDoNothing()
      .returning({ id: categories.id });

    return createdCategory;
  }

  async updateCategoryFromSource(
    categoryId: UUIDType,
    values: Pick<CategoryJsonbUpdate, "title" | "baseLanguage" | "availableLocales">,
  ) {
    await this.db
      .update(categories)
      .set({
        title: values.title,
        baseLanguage: values.baseLanguage,
        availableLocales: values.availableLocales,
      })
      .where(eq(categories.id, categoryId));
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

  async createTargetCourse(values: CourseJsonbInsert): Promise<UUIDType> {
    const [createdCourse] = await this.db
      .insert(courses)
      .values(values)
      .returning({ id: courses.id });
    return createdCourse.id;
  }

  async updateTargetCourse(courseId: UUIDType, values: CourseJsonbUpdate): Promise<void> {
    await this.db.update(courses).set(values).where(eq(courses.id, courseId));
  }

  async updateTargetCourseChapterCount(courseId: UUIDType, chapterCount: number): Promise<void> {
    await this.db.update(courses).set({ chapterCount }).where(eq(courses.id, courseId));
  }

  async createTargetChapter(values: ChapterJsonbInsert): Promise<UUIDType> {
    const [created] = await this.db.insert(chapters).values(values).returning({ id: chapters.id });
    return created.id;
  }

  async updateTargetChapter(chapterId: UUIDType, values: ChapterJsonbUpdate) {
    await this.db.update(chapters).set(values).where(eq(chapters.id, chapterId));
  }

  async createTargetLesson(values: LessonJsonbInsert): Promise<UUIDType> {
    const [created] = await this.db.insert(lessons).values(values).returning({ id: lessons.id });
    return created.id;
  }

  async updateTargetLesson(lessonId: UUIDType, values: LessonJsonbUpdate) {
    await this.db.update(lessons).set(values).where(eq(lessons.id, lessonId));
  }

  async createTargetQuestion(values: QuestionJsonbInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(questions)
      .values(values)
      .returning({ id: questions.id });
    return created.id;
  }

  async updateTargetQuestion(questionId: UUIDType, values: QuestionJsonbUpdate) {
    await this.db.update(questions).set(values).where(eq(questions.id, questionId));
  }

  async createTargetOption(values: QuestionAnswerOptionJsonbInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(questionAnswerOptions)
      .values(values)
      .returning({ id: questionAnswerOptions.id });
    return created.id;
  }

  async updateTargetOption(optionId: UUIDType, values: QuestionAnswerOptionJsonbUpdate) {
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

  async createAiMentor(values: AiMentorLessonInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(aiMentorLessons)
      .values(values)
      .returning({ id: aiMentorLessons.id });
    return created.id;
  }

  async updateAiMentor(aiMentorId: UUIDType, values: Partial<AiMentorLessonInsert>) {
    await this.db.update(aiMentorLessons).set(values).where(eq(aiMentorLessons.id, aiMentorId));
  }

  async removeAiMentorDocumentLinks(aiMentorLessonIds: UUIDType[]) {
    if (!aiMentorLessonIds.length) return;

    await this.db
      .delete(documentToAiMentorLesson)
      .where(inArray(documentToAiMentorLesson.aiMentorLessonId, aiMentorLessonIds));
  }

  async createDocument(values: DocumentInsert): Promise<UUIDType> {
    const [created] = await this.db
      .insert(documents)
      .values(values)
      .returning({ id: documents.id });
    return created.id;
  }

  async findDocumentByChecksum(checksum: string) {
    const [document] = await this.db
      .select({ id: documents.id })
      .from(documents)
      .where(eq(documents.checksum, checksum))
      .limit(1);

    return document;
  }

  async updateDocument(documentId: UUIDType, values: Partial<DocumentInsert>) {
    await this.db.update(documents).set(values).where(eq(documents.id, documentId));
  }

  async removeDocumentChunks(documentIds: UUIDType[]) {
    if (!documentIds.length) return;

    await this.db.delete(docChunks).where(inArray(docChunks.documentId, documentIds));
  }

  async createDocumentChunk(values: DocChunkInsert) {
    await this.db.insert(docChunks).values(values);
  }

  async createAiMentorDocumentLink(values: DocumentToAiMentorLessonInsert) {
    await this.db.insert(documentToAiMentorLesson).values(values).onConflictDoNothing();
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

  async updateResource(resourceId: UUIDType, values: Partial<ResourceInsert>) {
    await this.db.update(resources).set(values).where(eq(resources.id, resourceId));
  }

  async deleteResourcesByIds(resourceIds: UUIDType[]) {
    if (!resourceIds.length) return;

    await this.db.delete(resources).where(inArray(resources.id, resourceIds));
  }

  async createResourceRelation(values: ResourceEntityInsert) {
    await this.db.insert(resourceEntity).values(values);
  }

  async removeScormPackagesForMappedTargets(params: {
    targetCourseId: UUIDType;
    targetLessonIds: UUIDType[];
  }) {
    const conditions = [
      and(
        eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.COURSE),
        eq(scormPackages.entityId, params.targetCourseId),
      ),
    ];

    if (params.targetLessonIds.length) {
      conditions.push(
        and(
          eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.LESSON),
          inArray(scormPackages.entityId, params.targetLessonIds),
        ),
      );
    }

    await this.db.delete(scormPackages).where(or(...conditions));
  }

  async createScormPackage(values: ScormPackageInsert) {
    await this.db.insert(scormPackages).values(values);
  }

  async createScormSco(values: ScormScoInsert) {
    await this.db.insert(scormScos).values(values);
  }
}
