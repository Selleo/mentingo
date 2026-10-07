/** Builds tenant-scoped authoring context and baseline hashes used for safe targeted edits. */
import { createHash } from "node:crypto";

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ENTITY_TYPES, PERMISSIONS, hasPermission, type LessonTypes } from "@repo/shared";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { setJsonbField } from "src/common/helpers/sqlHelpers";
import {
  CourseAuthoringBlockError,
  getCourseAuthoringBlocks,
  normalizeCourseAuthoringBlocks,
} from "src/common/utils/courseAuthoringBlocks";
import { AiJudgeConfigurationService } from "src/lesson/ai-judge-configuration/ai-judge-configuration.service";
import { AiMentorConfigurationService } from "src/lesson/ai-mentor-configuration/services/ai-mentor-configuration.service";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { LocalizationService } from "src/localization/localization.service";
import { PermissionsService } from "src/permissions/permissions.service";
import { QuizAuthoringService } from "src/quiz/services/quiz-authoring.service";
import { DB } from "src/storage/db/db.providers";
import {
  assessments,
  assessmentAttempts,
  aiJudgeConfigurations,
  aiMentorConfigurations,
  aiMentorLessons,
  chapters,
  courses,
  lessons,
} from "src/storage/schema";

import type {
  AuthoringChapterContext,
  AuthoringContextAssessmentRow,
  AuthoringContextChapterRow,
  AuthoringContextLessonRow,
  AuthoringContextMentorVersionRow,
  AuthoringLessonContext,
  AuthoringMentorContextLesson,
  AuthoringSelectedLessonDetails,
} from "./course-authoring-context.types";
import type {
  AuthoringContextQuery,
  AuthoringCourseContext,
} from "./schema/course-authoring.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { CoursesSettings } from "src/courses/types/settings";

const AUTHORING_COURSE_ALLOWED_FIELDS = [
  "title",
  "description",
  "learningOutcomes",
  "thumbnailAssetId",
  "lessonSequenceEnabled",
  "quizFeedbackEnabled",
  "videoCompletionTrackingEnabled",
  "certificateFontColor",
  "certificateValidity",
  "applyValidityToExistingCertificates",
  "removeCertificateSignature",
  "certificateSignatureAssetId",
];

@Injectable()
/** Authorizes editors and constructs the native context used for targeted authoring. */
export class CourseAuthoringContextService {
  /** Injects tenant DB, access, localization, and native lesson detail services. */
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly adminLessonService: AdminLessonService,
    private readonly localizationService: LocalizationService,
    private readonly permissionsService: PermissionsService,
    private readonly quizAuthoring: QuizAuthoringService,
    private readonly mentorConfigurations: AiMentorConfigurationService,
    private readonly judgeConfigurations: AiJudgeConfigurationService,
  ) {}

  /** Re-resolves permissions and course access for each request or background command. */
  async authorize(courseId: UUIDType, actor: CurrentUserType) {
    const access = await this.permissionsService.getUserAccess(actor.userId);
    const currentActor = { ...actor, ...access };
    if (!hasPermission(currentActor.permissions, PERMISSIONS.COURSE_AI_GENERATION)) {
      throw new ForbiddenException("common.toast.noAccess");
    }
    await this.adminLessonService.validateAccess(ENTITY_TYPES.COURSE, currentActor, courseId);
    return currentActor;
  }

  /** Reads only localized content lesson bodies within the actor-authorized course and tenant. */
  async getMentorContextLessons(
    courseId: UUIDType,
    language: AuthoringContextQuery["language"],
    actor: CurrentUserType,
  ): Promise<AuthoringMentorContextLesson[]> {
    const currentActor = await this.authorize(courseId, actor);
    return this.db
      .select({
        id: lessons.id,
        chapterId: chapters.id,
        chapterTitle: this.localizationService.getLocalizedSqlField(chapters.title, language),
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(
        and(
          eq(chapters.courseId, courseId),
          eq(courses.tenantId, currentActor.tenantId),
          eq(lessons.type, "content"),
        ),
      )
      .orderBy(asc(chapters.displayOrder), asc(lessons.displayOrder), asc(lessons.id));
  }

  /** Persist identity metadata once; never change content, progress, or other locales. */
  /** Normalizes supported lesson blocks under row locks without altering unsupported markup. */
  async prepareBlockIdentities(
    courseId: UUIDType,
    language: AuthoringContextQuery["language"],
    actor: CurrentUserType,
  ) {
    await this.authorize(courseId, actor);
    await this.db.transaction(async (transaction) => {
      const rows = await transaction
        .select({ id: lessons.id, description: lessons.description })
        .from(lessons)
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .where(and(eq(chapters.courseId, courseId), eq(lessons.type, "content")))
        .for("update", { of: lessons });
      for (const row of rows) {
        const original = row.description?.[language];
        if (!original) continue;
        try {
          const normalized = normalizeCourseAuthoringBlocks(original);
          if (normalized !== original)
            await transaction
              .update(lessons)
              .set({
                description: setJsonbField(lessons.description, language, normalized),
              })
              .where(eq(lessons.id, row.id));
        } catch (error) {
          // Unsupported legacy markup remains editable as a whole lesson.
          if (!(error instanceof CourseAuthoringBlockError)) throw error;
        }
      }
    });
  }

  /** Reads localized course structure, selected details, and stable baseline hashes. */
  async getContext(
    courseId: UUIDType,
    query: AuthoringContextQuery,
    actor: CurrentUserType,
    chapterIds: readonly UUIDType[] = [],
  ): Promise<AuthoringCourseContext> {
    await this.authorize(courseId, actor);
    const [course] = await this.db
      .select({
        id: courses.id,
        status: courses.status,
        title: this.localizationService.getLocalizedSqlField(courses.title, query.language),
        description: this.localizationService.getLocalizedSqlField(
          courses.description,
          query.language,
        ),
        availableLocales: courses.availableLocales,
        settings: courses.settings,
        learningOutcomes: courses.learningOutcomes,
        thumbnailS3Key: courses.thumbnailS3Key,
      })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.tenantId, actor.tenantId)));
    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.course");
    if (!course.availableLocales.includes(query.language))
      throw new BadRequestException("adminCourseView.toast.languageNotSupported");
    const chapterRows = await this.db
      .select({
        id: chapters.id,
        title: this.localizationService.getLocalizedSqlField(chapters.title, query.language),
        displayOrder: chapters.displayOrder,
      })
      .from(chapters)
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(chapters.courseId, courseId))
      .orderBy(asc(chapters.displayOrder), asc(chapters.id));
    const lessonRows = await this.db
      .select({
        id: lessons.id,
        chapterId: lessons.chapterId,
        title: this.localizationService.getLocalizedSqlField(lessons.title, query.language),
        description: this.localizationService.getLocalizedSqlField(
          lessons.description,
          query.language,
        ),
        lessonType: sql<LessonTypes>`${lessons.type}`,
        displayOrder: lessons.displayOrder,
        updatedAt: lessons.updatedAt,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(eq(chapters.courseId, courseId))
      .orderBy(asc(lessons.displayOrder), asc(lessons.id));
    const assessmentRows = await this.db
      .select({
        lessonId: assessments.lessonId,
        attemptCount: sql<number>`count(${assessmentAttempts.id})`.mapWith(Number),
        cooldownHours: sql<
          number | null
        >`extract(epoch from ${assessments.attemptCooldown}) / 3600`.mapWith((value) =>
          value === null ? null : Number(value),
        ),
      })
      .from(assessments)
      .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(assessmentAttempts, eq(assessmentAttempts.assessmentId, assessments.id))
      .where(eq(chapters.courseId, courseId))
      .groupBy(assessments.id, assessments.lessonId, assessments.attemptCooldown);
    const selected = new Set(query.lessonIds ?? []);
    const selectedChapters = new Set(chapterIds);
    if (chapterIds.some((id) => !chapterRows.some((chapter) => chapter.id === id))) {
      throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");
    }
    for (const lesson of lessonRows) {
      if (selectedChapters.has(lesson.chapterId)) selected.add(lesson.id);
    }
    const mentorVersions = await this.db
      .select({
        lessonId: aiMentorLessons.lessonId,
        configurationUpdatedAt: aiMentorConfigurations.updatedAt,
        judgeUpdatedAt: aiJudgeConfigurations.updatedAt,
      })
      .from(aiMentorLessons)
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(
        aiMentorConfigurations,
        eq(aiMentorConfigurations.aiMentorLessonId, aiMentorLessons.id),
      )
      .leftJoin(
        aiJudgeConfigurations,
        eq(aiJudgeConfigurations.aiMentorLessonId, aiMentorLessons.id),
      )
      .where(eq(chapters.courseId, courseId));
    if ([...selected].some((id) => !lessonRows.some((lesson) => lesson.id === id))) {
      throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");
    }
    const detailed = await this.buildDetailedLessons(
      lessonRows.filter((row) => selected.has(row.id)),
      assessmentRows,
      actor,
      query.language,
    );
    return {
      courseId,
      language: query.language,
      course: {
        id: course.id,
        status: course.status,
        title: course.title ?? "",
        description: course.description ?? "",
        learningOutcomes: course.learningOutcomes?.[query.language] ?? [],
        settings: this.authoringCourseSettings(course.settings),
        allowedFields: AUTHORING_COURSE_ALLOWED_FIELDS,
      },
      title: course.title ?? "",
      description: course.description ?? "",
      fieldHashes: Object.fromEntries(
        Object.entries({
          title: course.title ?? "",
          description: course.description ?? "",
          learningOutcomes: course.learningOutcomes?.[query.language] ?? [],
          thumbnailAssetId: course.thumbnailS3Key,
          ...course.settings,
          certificateSignatureAssetId: course.settings.certificateSignature,
          removeCertificateSignature: course.settings.certificateSignature,
          applyValidityToExistingCertificates: course.settings.certificateValidity,
        }).map(([field, value]) => [field, this.hash(value ?? null)]),
      ),
      baselineHash: this.courseBaselineHash(course, chapterRows),
      chapters: chapterRows.map((chapter) =>
        this.buildChapterContext(
          chapter,
          lessonRows,
          mentorVersions,
          new Set(lessonRows.map((lesson) => lesson.id)),
          selected,
          detailed,
          assessmentRows,
        ),
      ),
    };
  }

  /** Reads only selected lessons and their parent chapters for continuation fulfillment. */
  async getSelectedLessonDetails(
    courseId: UUIDType,
    language: AuthoringContextQuery["language"],
    lessonIds: readonly UUIDType[],
    actor: CurrentUserType,
  ): Promise<AuthoringSelectedLessonDetails> {
    const currentActor = await this.authorize(courseId, actor);
    const selectedIds = [...new Set(lessonIds)];
    if (!selectedIds.length || selectedIds.length > 100)
      throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");

    const [course] = await this.db
      .select({ id: courses.id, availableLocales: courses.availableLocales })
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.tenantId, actor.tenantId)));
    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.course");
    if (!course.availableLocales.includes(language))
      throw new BadRequestException("adminCourseView.toast.languageNotSupported");

    const selectedLessonRows = await this.db
      .select({
        id: lessons.id,
        chapterId: lessons.chapterId,
        title: this.localizationService.getLocalizedSqlField(lessons.title, language),
        description: this.localizationService.getLocalizedSqlField(lessons.description, language),
        lessonType: sql<LessonTypes>`${lessons.type}`,
        displayOrder: lessons.displayOrder,
        updatedAt: lessons.updatedAt,
      })
      .from(lessons)
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(eq(chapters.courseId, courseId), inArray(lessons.id, selectedIds)))
      .orderBy(asc(lessons.displayOrder), asc(lessons.id));
    if (
      selectedLessonRows.length !== selectedIds.length ||
      selectedIds.some((id) => !selectedLessonRows.some((row) => row.id === id))
    )
      throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");

    const parentChapterIds = [...new Set(selectedLessonRows.map((row) => row.chapterId))];
    const chapterRows = await this.db
      .select({
        id: chapters.id,
        title: this.localizationService.getLocalizedSqlField(chapters.title, language),
        displayOrder: chapters.displayOrder,
      })
      .from(chapters)
      .innerJoin(courses, eq(courses.id, chapters.courseId))
      .where(and(eq(chapters.courseId, courseId), inArray(chapters.id, parentChapterIds)))
      .orderBy(asc(chapters.displayOrder), asc(chapters.id));
    if (
      chapterRows.length !== parentChapterIds.length ||
      parentChapterIds.some((id) => !chapterRows.some((chapter) => chapter.id === id))
    )
      throw new BadRequestException("courseAuthoring.errors.targetOutsideCourse");

    const assessmentRows = await this.db
      .select({
        lessonId: assessments.lessonId,
        attemptCount: sql<number>`count(${assessmentAttempts.id})`.mapWith(Number),
        cooldownHours: sql<
          number | null
        >`extract(epoch from ${assessments.attemptCooldown}) / 3600`.mapWith((value) =>
          value === null ? null : Number(value),
        ),
      })
      .from(assessments)
      .innerJoin(lessons, eq(lessons.id, assessments.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(assessmentAttempts, eq(assessmentAttempts.assessmentId, assessments.id))
      .where(and(eq(chapters.courseId, courseId), inArray(assessments.lessonId, selectedIds)))
      .groupBy(assessments.id, assessments.lessonId, assessments.attemptCooldown);
    const mentorVersions = await this.db
      .select({
        lessonId: aiMentorLessons.lessonId,
        configurationUpdatedAt: aiMentorConfigurations.updatedAt,
        judgeUpdatedAt: aiJudgeConfigurations.updatedAt,
      })
      .from(aiMentorLessons)
      .innerJoin(lessons, eq(lessons.id, aiMentorLessons.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .leftJoin(
        aiMentorConfigurations,
        eq(aiMentorConfigurations.aiMentorLessonId, aiMentorLessons.id),
      )
      .leftJoin(
        aiJudgeConfigurations,
        eq(aiJudgeConfigurations.aiMentorLessonId, aiMentorLessons.id),
      )
      .where(and(eq(chapters.courseId, courseId), inArray(lessons.id, selectedIds)));
    const detailed = await this.buildDetailedLessons(
      selectedLessonRows,
      assessmentRows,
      currentActor,
      language,
    );
    const selected = new Set(selectedIds);
    return {
      courseId,
      language,
      chapters: chapterRows.map((chapter) => ({
        ...chapter,
        title: chapter.title ?? "",
        lessons: selectedLessonRows
          .filter((lesson) => lesson.chapterId === chapter.id)
          .map((lesson) =>
            this.buildLessonContext(lesson, mentorVersions, detailed, assessmentRows, selected),
          ),
      })),
    };
  }

  /** Loads provider-specific detail only for the lessons selected by the caller. */
  private async buildDetailedLessons(
    lessonRows: readonly AuthoringContextLessonRow[],
    assessmentRows: readonly AuthoringContextAssessmentRow[],
    actor: CurrentUserType,
    language: AuthoringContextQuery["language"],
  ): Promise<Map<string, Partial<AuthoringLessonContext>>> {
    const detailed = new Map<string, Partial<AuthoringLessonContext>>();
    for (const lesson of lessonRows) {
      if (lesson.lessonType === "quiz") {
        const quiz = await this.quizAuthoring.getQuizLessonForAuthoring(lesson.id, language);
        if (quiz)
          detailed.set(lesson.id, {
            quiz: {
              lessonType: "quiz",
              title: lesson.title ?? "",
              description: lesson.description ?? "",
              thresholdScore: Number(quiz.assessment.passingScorePercentage),
              attemptsLimit: quiz.assessment.maximumAttempts,
              quizCooldownInHours:
                assessmentRows.find((item) => item.lessonId === lesson.id)?.cooldownHours ?? null,
              questions: quiz.questions,
            },
          });
      } else if (lesson.lessonType === "ai_mentor") {
        detailed.set(lesson.id, {
          mentorConfiguration: await this.mentorConfigurations.getConfiguration(
            lesson.id,
            actor,
            language,
          ),
          judgeConfiguration: await this.judgeConfigurations.getConfiguration(
            lesson.id,
            actor,
            language,
          ),
        });
      }
    }
    return detailed;
  }

  /** Builds one lesson with the same baseline and optional detail semantics as getContext. */
  private buildLessonContext(
    lesson: AuthoringContextLessonRow,
    mentorVersions: readonly AuthoringContextMentorVersionRow[],
    detailed: ReadonlyMap<string, Partial<AuthoringLessonContext>>,
    assessmentRows: readonly AuthoringContextAssessmentRow[],
    detailedLessonIds: ReadonlySet<string> = new Set(),
  ): AuthoringLessonContext {
    const detail = detailed.get(lesson.id);
    return {
      id: lesson.id,
      title: lesson.title ?? "",
      lessonType: lesson.lessonType,
      assessmentAttemptCount:
        assessmentRows.find((item) => item.lessonId === lesson.id)?.attemptCount ?? 0,
      displayOrder: lesson.displayOrder,
      baselineHash: this.hash({
        ...lesson,
        mentorVersion: mentorVersions.find((entry) => entry.lessonId === lesson.id),
      }),
      ...(detailedLessonIds.has(lesson.id)
        ? {
            description: lesson.description ?? "",
            ...(detail ?? {}),
            ...(lesson.lessonType === "content"
              ? { blocks: this.readBlocks(lesson.description ?? "") }
              : {}),
          }
        : {}),
    };
  }

  /** Builds a complete chapter while keeping structural hashes independent of detail selection. */
  private buildChapterContext(
    chapter: AuthoringContextChapterRow,
    lessonRows: readonly AuthoringContextLessonRow[],
    mentorVersions: readonly AuthoringContextMentorVersionRow[],
    visibleLessonIds: ReadonlySet<string>,
    detailedLessonIds: ReadonlySet<string>,
    detailed: ReadonlyMap<string, Partial<AuthoringLessonContext>>,
    assessmentRows: readonly AuthoringContextAssessmentRow[],
  ): AuthoringChapterContext {
    const chapterLessons = lessonRows.filter((lesson) => lesson.chapterId === chapter.id);
    return {
      ...chapter,
      title: chapter.title ?? "",
      deletionBaselineHash: this.hash({
        ...chapter,
        lessons: chapterLessons.map((lesson) => ({
          ...lesson,
          mentorVersion: mentorVersions.find((entry) => entry.lessonId === lesson.id),
        })),
      }),
      baselineHash: this.hash({
        ...chapter,
        lessons: chapterLessons.map(({ id, displayOrder }) => ({ id, displayOrder })),
      }),
      lessons: chapterLessons
        .filter((lesson) => visibleLessonIds.has(lesson.id))
        .map((lesson) =>
          this.buildLessonContext(
            lesson,
            mentorVersions,
            detailed,
            assessmentRows,
            detailedLessonIds,
          ),
        ),
    };
  }

  /** Produces the course structural baseline used by the existing full context. */
  private courseBaselineHash(
    course: {
      title: string | null;
      description: string | null;
      settings: unknown;
      learningOutcomes: unknown;
      thumbnailS3Key: string | null;
    },
    chapterRows: readonly Pick<AuthoringContextChapterRow, "id" | "displayOrder">[],
  ) {
    return this.hash({
      title: course.title,
      description: course.description,
      settings: course.settings,
      learningOutcomes: course.learningOutcomes,
      thumbnailS3Key: course.thumbnailS3Key,
      chapters: chapterRows.map(({ id, displayOrder }) => ({ id, displayOrder })),
    });
  }

  /** Extracts block identities while treating legacy unsupported markup as whole-lesson content. */
  private readBlocks(content: string) {
    try {
      return getCourseAuthoringBlocks(content);
    } catch (error) {
      if (error instanceof CourseAuthoringBlockError) return [];
      throw error;
    }
  }

  /** Produces the stable SHA-256 representation used for conflict detection. */
  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  /** Exposes author-readable settings while excluding the certificate storage key. */
  private authoringCourseSettings(settings: CoursesSettings) {
    return {
      lessonSequenceEnabled: settings.lessonSequenceEnabled,
      quizFeedbackEnabled: settings.quizFeedbackEnabled,
      videoCompletionTrackingEnabled: settings.videoCompletionTrackingEnabled,
      certificateFontColor: settings.certificateFontColor,
      certificateValidity: settings.certificateValidity,
    };
  }
}
