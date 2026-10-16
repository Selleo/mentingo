import { Injectable, NotFoundException } from "@nestjs/common";
import { LESSON_TYPES } from "@repo/shared";

import {
  extractResourceIdsFromRichText,
  getLocalizedRichTextEntries,
} from "src/resource-library/resource-library.utils";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CourseTransferSnapshotRepository } from "../repositories/course-transfer-snapshot.repository";

import type { UUIDType } from "src/common";
import type {
  CourseSelect,
  SourceSnapshot,
} from "src/course-transfer/types/course-transfer-graph.types";

@Injectable()
export class CourseTransferSnapshotService {
  constructor(
    private readonly courseTransferSnapshotRepository: CourseTransferSnapshotRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  /** Reads the complete source course graph in one consistent read-only source transaction. */
  async readCourse(source: { tenantId: UUIDType; courseId: UUIDType }): Promise<SourceSnapshot> {
    return this.tenantDbRunnerService.runWithTenant(source.tenantId, () =>
      this.tenantDbRunnerService.transactionWithHandle(
        async () => {
          const sourceCourse = await this.courseTransferSnapshotRepository.getSourceCourse(
            source.courseId,
          );
          if (!sourceCourse) throw new NotFoundException("masterCourse.error.sourceCourseNotFound");

          const snapshot = await this.buildSourceSnapshot(sourceCourse);
          if (!snapshot) throw new NotFoundException("masterCourse.error.sourceCategoryNotFound");

          return snapshot;
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      ),
    );
  }

  async findSourceCourse(courseId: UUIDType) {
    return this.courseTransferSnapshotRepository.getSourceCourse(courseId);
  }

  /**
   * Reads a learning path and its course links in one consistent snapshot. Legacy membership rows
   * can carry stale tenant IDs, so both reads authorize through the source tenant.
   */
  async readLearningPath(source: { tenantId: UUIDType; learningPathId: UUIDType }) {
    return this.courseTransferSnapshotRepository.inReadOnlyTransaction(async (transaction) => {
      const learningPath = await this.courseTransferSnapshotRepository.findSourceLearningPath(
        source.tenantId,
        source.learningPathId,
        transaction,
      );
      if (!learningPath) return null;

      const courseLinks =
        await this.courseTransferSnapshotRepository.findSourceLearningPathCourseLinks(
          source.tenantId,
          source.learningPathId,
          transaction,
        );

      return { learningPath, courseLinks };
    });
  }

  /** Builds a course graph in the caller's current tenant context. */
  async buildSourceSnapshot(sourceCourse: CourseSelect): Promise<SourceSnapshot | null> {
    const course = {
      ...sourceCourse,
      authorMetadata:
        sourceCourse.authorMetadata ??
        (await this.courseTransferSnapshotRepository.getCourseAuthorMetadata(
          sourceCourse.authorId,
        )),
    };

    const sourceCategoryRow =
      await this.courseTransferSnapshotRepository.getSourceCategoryWithBaseTitle(course);

    if (!sourceCategoryRow) return null;

    const { baseTitle, ...sourceCategory } = sourceCategoryRow;
    const chapterRows = await this.courseTransferSnapshotRepository.getSourceChapters(course.id);
    const lessonRows = await this.courseTransferSnapshotRepository.getSourceLessons(course.id);
    const lessonIds = lessonRows.map((row) => row.id);
    const questionRows = await this.courseTransferSnapshotRepository.getSourceQuestions(lessonIds);
    const assessmentRows =
      await this.courseTransferSnapshotRepository.getSourceAssessments(lessonIds);
    const questionIds = questionRows.map((row) => row.id);
    const openTextSettingsRows =
      await this.courseTransferSnapshotRepository.getSourceOpenTextSettings(questionIds);
    const questionResourceRows =
      await this.courseTransferSnapshotRepository.getSourceQuestionResources(questionIds);
    const optionRows = await this.courseTransferSnapshotRepository.getSourceOptions(questionIds);
    const blankRows =
      await this.courseTransferSnapshotRepository.getSourceQuestionBlanks(questionIds);
    const blankIds = blankRows.map(({ id }) => id);
    const [blankAnswerSetRows, dragAndDropOptionRows, scaleOptionRows, trueFalseStatementRows] =
      await Promise.all([
        this.courseTransferSnapshotRepository.getSourceBlankAnswerSets(blankIds),
        this.courseTransferSnapshotRepository.getSourceDragAndDropOptions(questionIds),
        this.courseTransferSnapshotRepository.getSourceScaleOptions(questionIds),
        this.courseTransferSnapshotRepository.getSourceTrueFalseStatements(questionIds),
      ]);
    const aiMentorRows = await this.courseTransferSnapshotRepository.getSourceAiMentors(lessonIds);
    const aiMentorIds = aiMentorRows.map((row) => row.id);
    const aiMentorConfigurationRows =
      await this.courseTransferSnapshotRepository.getSourceAiMentorConfigurations(aiMentorIds);
    const aiMentorConfigurationIds = aiMentorConfigurationRows.map((row) => row.id);
    const [aiMentorTeacherConfigurationRows, aiMentorRoleplayConfigurationRows] =
      aiMentorConfigurationIds.length
        ? await Promise.all([
            this.courseTransferSnapshotRepository.getSourceAiMentorTeacherConfigurations(
              aiMentorConfigurationIds,
            ),
            this.courseTransferSnapshotRepository.getSourceAiMentorRoleplayConfigurations(
              aiMentorConfigurationIds,
            ),
          ])
        : [[], []];
    let aiJudgeConfigurationRows: SourceSnapshot["aiJudgeConfigurations"] = [];
    if (aiMentorIds.length)
      aiJudgeConfigurationRows =
        await this.courseTransferSnapshotRepository.getSourceAiJudgeConfigurations(aiMentorIds);
    const aiJudgeConfigurationIds = aiJudgeConfigurationRows.map((row) => row.id);
    let aiJudgeCriterionRows: SourceSnapshot["aiJudgeCriteria"] = [];
    let aiJudgeBlockingErrorRows: SourceSnapshot["aiJudgeBlockingErrors"] = [];
    if (aiJudgeConfigurationIds.length)
      [aiJudgeCriterionRows, aiJudgeBlockingErrorRows] = await Promise.all([
        this.courseTransferSnapshotRepository.getSourceAiJudgeCriteria(aiJudgeConfigurationIds),
        this.courseTransferSnapshotRepository.getSourceAiJudgeBlockingErrors(
          aiJudgeConfigurationIds,
        ),
      ]);
    const aiJudgeCriterionIds = aiJudgeCriterionRows.map((row) => row.id);
    let aiJudgeScoreGuidanceRows: SourceSnapshot["aiJudgeScoreGuidance"] = [];
    if (aiJudgeCriterionIds.length)
      aiJudgeScoreGuidanceRows =
        await this.courseTransferSnapshotRepository.getSourceAiJudgeScoreGuidance(
          aiJudgeCriterionIds,
        );
    const aiMentorDocumentLinkRows =
      await this.courseTransferSnapshotRepository.getSourceAiMentorDocumentLinks(aiMentorIds);
    const aiMentorDocumentIds = aiMentorDocumentLinkRows.map((row) => row.documentId);
    const aiMentorDocumentRows =
      await this.courseTransferSnapshotRepository.getSourceDocuments(aiMentorDocumentIds);
    const aiMentorDocChunkRows =
      await this.courseTransferSnapshotRepository.getSourceDocChunks(aiMentorDocumentIds);
    const scormLessonIds = lessonRows
      .filter((lesson) => lesson.type === LESSON_TYPES.SCORM)
      .map((lesson) => lesson.id);
    const scormPackageRows = await this.courseTransferSnapshotRepository.getSourceScormPackages(
      course.id,
      scormLessonIds,
    );
    const scormPackageIds = scormPackageRows.map((row) => row.id);
    const scormScoRows = await this.courseTransferSnapshotRepository.getSourceScormScos(
      scormPackageIds,
      scormLessonIds,
    );
    const lessonResourceRows =
      await this.courseTransferSnapshotRepository.getSourceLessonResources(lessonIds);
    const lessonContentResourceRows = await this.courseTransferSnapshotRepository.getResourcesByIds(
      this.getLessonContentResourceIds(lessonRows),
    );
    const courseResourceRows = await this.courseTransferSnapshotRepository.getSourceCourseResources(
      course.id,
    );

    return {
      course,
      category: sourceCategory,
      categoryBaseTitle: baseTitle,
      chapters: chapterRows,
      lessons: lessonRows,
      questions: questionRows,
      assessments: assessmentRows,
      options: optionRows,
      assessmentQuestionBlanks: blankRows,
      assessmentQuestionBlankAnswerSets: blankAnswerSetRows,
      assessmentQuestionDragAndDropOptions: dragAndDropOptionRows,
      assessmentQuestionScaleOptions: scaleOptionRows,
      assessmentQuestionTrueFalseStatements: trueFalseStatementRows,
      questionResources: questionResourceRows,
      assessmentQuestionOpenTextSettings: openTextSettingsRows,
      aiMentors: aiMentorRows,
      aiMentorConfigurations: aiMentorConfigurationRows,
      aiMentorTeacherConfigurations: aiMentorTeacherConfigurationRows,
      aiMentorRoleplayConfigurations: aiMentorRoleplayConfigurationRows,
      aiJudgeConfigurations: aiJudgeConfigurationRows,
      aiJudgeCriteria: aiJudgeCriterionRows,
      aiJudgeScoreGuidance: aiJudgeScoreGuidanceRows,
      aiJudgeBlockingErrors: aiJudgeBlockingErrorRows,
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

  private getLessonContentResourceIds(lessons: SourceSnapshot["lessons"]): UUIDType[] {
    return [
      ...new Set(
        lessons.flatMap((lesson) =>
          getLocalizedRichTextEntries(lesson.description).flatMap(([, content]) =>
            extractResourceIdsFromRichText(content),
          ),
        ),
      ),
    ] as UUIDType[];
  }
}
