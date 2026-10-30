import {
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  COURSE_STATUSES,
  PERMISSIONS,
  type PermissionKey,
  type SupportedLanguages,
} from "@repo/shared";
import { match } from "ts-pattern";

import { AdminChapterRepository } from "src/chapter/repositories/adminChapter.repository";
import { canUpdateCourseByAuthor } from "src/common/permissions/course-permission.utils";
import { hasPermission } from "src/common/permissions/permission.utils";
import { CourseRepetitionService } from "src/course-repetition/course-repetition.service";
import { IMAGE_QUALITY } from "src/file/image-variants/image-variant.constants";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { AdminLessonService } from "src/lesson/services/adminLesson.service";
import { SettingsService } from "src/settings/settings.service";
import { UserService } from "src/user/user.service";

import { CourseSlugService } from "../authoring/course-slug.service";
import { CourseDurationService } from "../duration/course-duration.service";
import { CourseStudentModeService } from "../learning-mode/course-student-mode.service";
import { CourseLessonMediaService } from "../media/course-lesson-media.service";
import { CourseMediaUrlService } from "../media/course-media-url.service";

import { CourseDetailRepository } from "./course-detail.repository";

import type { CourseReadOptions } from "../course.types";
import type { CourseLookupResponse } from "../schemas/courseLookupResponse.schema";
import type { CommonShowBetaCourse, CommonShowCourse } from "../schemas/showCourseCommon.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { AdminLessonWithContentSchema } from "src/lesson/lesson.schema";

const ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000";
const NON_PUBLIC_STATUSES: string[] = [COURSE_STATUSES.DRAFT, COURSE_STATUSES.PRIVATE];

@Injectable()
export class CourseDetailService {
  constructor(
    private readonly courseDetailRepository: CourseDetailRepository,
    private readonly courseSlugService: CourseSlugService,
    private readonly courseStudentModeService: CourseStudentModeService,
    private readonly courseRepetitionService: CourseRepetitionService,
    private readonly courseDurationService: CourseDurationService,
    private readonly courseMediaUrlService: CourseMediaUrlService,
    private readonly courseLessonMediaService: CourseLessonMediaService,
    private readonly settingsService: SettingsService,
    private readonly adminChapterRepository: AdminChapterRepository,
    private readonly adminLessonService: AdminLessonService,
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
  ) {}

  /**
   * Course page for learners, editors and group managers. Editors read the exact language unless
   * they are previewing as a student; `learnerOnly` reads apply learner access rules only.
   */
  async getCourse(
    idOrSlug: UUIDType | string,
    currentUser: CurrentUserType | undefined,
    language: SupportedLanguages,
    options: CourseReadOptions = {},
  ): Promise<CommonShowCourse> {
    await this.ensureAnonymousCourseAccess(currentUser?.userId);

    const userId = currentUser?.userId ?? ANONYMOUS_USER_ID;
    const userPermissions = currentUser?.permissions ?? [];
    const { courseId: id, slug: currentSlug } = match(
      await this.courseSlugService.getCourseIdBySlug(idOrSlug, language),
    )
      .with({ type: "notFound" }, () => {
        throw new NotFoundException("adminCourseView.errors.notFound.course");
      })
      .otherwise((value) => value);

    const courseAuthorId = await this.courseDetailRepository.findCourseAuthorId(id);

    if (!courseAuthorId) throw new NotFoundException("adminCourseView.errors.notFound.course");

    const isManagerPreview =
      !options.learnerOnly &&
      (await this.resolveGroupManagerCoursePreview({
        courseId: id,
        courseAuthorId,
        currentUser,
      }));

    const canManageCourses =
      hasPermission(userPermissions, PERMISSIONS.COURSE_UPDATE) ||
      hasPermission(userPermissions, PERMISSIONS.COURSE_UPDATE_OWN);
    const canEditCourse =
      !options.learnerOnly &&
      (hasPermission(userPermissions, PERMISSIONS.USER_MANAGE) ||
        (canManageCourses && userId === courseAuthorId));
    const isCourseStudentModeActive = userId
      ? await this.courseStudentModeService.isCourseStudentModeEnabled(id, userId)
      : false;
    const shouldUseExactLanguage = canEditCourse && !isCourseStudentModeActive;

    const course = await this.courseDetailRepository.findCourseDetail(
      id,
      userId,
      language,
      shouldUseExactLanguage,
    );

    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.course");

    const isEnrolled = !!course.enrolled;

    if (options.learnerOnly) this.assertLearnerCanReadCourse(course, isEnrolled, userPermissions);

    const isAdmin = hasPermission(userPermissions, PERMISSIONS.COURSE_UPDATE);

    if (
      !isAdmin &&
      userId !== course.authorId &&
      (NON_PUBLIC_STATUSES.includes(course.status) || course.isArchived) &&
      !isEnrolled
    )
      throw new ForbiddenException("common.toast.courseAccessDenied");

    if (currentUser && !isManagerPreview && isEnrolled) {
      await this.courseDetailRepository.runInTransaction((trx) =>
        this.courseRepetitionService.ensureCurrent(id, userId, trx),
      );
    }
    const learningState = await this.courseRepetitionService.getInfo(id, userId);

    const courseChapterList = await this.courseDetailRepository.findCourseChaptersWithProgress(
      id,
      userId,
      language,
      isEnrolled,
    );

    const durationHierarchy = await this.courseDurationService.getCourseDurationHierarchy(
      id,
      language,
    );

    const chaptersWithDuration = courseChapterList.map((chapter) => ({
      ...chapter,
      estimatedDurationSeconds: durationHierarchy.byChapterId[chapter.id] ?? 0,
      lessons: chapter.lessons.map((lesson) => ({
        ...lesson,
        estimatedDurationSeconds: durationHierarchy.byLessonId[lesson.id] ?? 0,
      })),
    }));

    const thumbnailUrl = await this.courseMediaUrlService.getSignedCourseThumbnailUrl(
      course.thumbnailS3Key,
      IMAGE_QUALITY.XL,
    );
    const trailerUrl = await this.courseMediaUrlService.getCourseTrailerUrl(course.id);

    const { authorMetadata, ...courseData } = course;

    const author = authorMetadata
      ? {
          firstName: authorMetadata.firstName,
          lastName: authorMetadata.lastName,
          jobTitle: authorMetadata.jobTitle,
          description: authorMetadata.description,
          profilePictureUrl: await this.userService.getUsersProfilePictureUrl(
            authorMetadata.profilePictureReference,
          ),
        }
      : await this.userService.getUserDetails(course.authorId, null);

    return {
      ...courseData,
      learningState,
      completedChapterCount:
        learningState.repetition?.finishedChapterCount ?? courseData.completedChapterCount,
      author,
      thumbnailUrl: thumbnailUrl ?? undefined,
      estimatedDurationSeconds: durationHierarchy.totalSeconds,

      trailerUrl,
      chapters: chaptersWithDuration,
      slug: currentSlug,
      isManagerPreview,
    };
  }

  /** Resolves a slug or ID, hiding courses the viewer may not see behind "not found". */
  async lookupCourse(
    idOrSlug: string,
    language: SupportedLanguages,
    userId?: UUIDType,
    userPermissions: PermissionKey[] = [],
  ): Promise<CourseLookupResponse> {
    await this.ensureAnonymousCourseAccess(userId);

    const lookupResult = await this.courseSlugService.getCourseIdBySlug(idOrSlug, language);

    if (lookupResult.type === "notFound") {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }

    const course = await this.courseDetailRepository.findCourseVisibility(
      lookupResult.courseId,
      userId,
    );

    if (!course) {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }

    const isHidden = NON_PUBLIC_STATUSES.includes(course.status) || course.isArchived;
    const canSeeHiddenCourse =
      userId !== undefined &&
      (hasPermission(userPermissions, PERMISSIONS.COURSE_UPDATE) ||
        userId === course.authorId ||
        !!course.enrolled);

    if (isHidden && !canSeeHiddenCourse) {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }

    return match(lookupResult)
      .with({ type: "redirect" }, (value) => ({
        status: "redirect" as const,
        slug: value.slug,
      }))
      .with({ type: "found" }, { type: "uuid" }, (value) => ({
        status: "found" as const,
        slug: value.slug,
      }))
      .exhaustive();
  }

  /** Authoring view of the course with every chapter's lessons and signed media. */
  async getBetaCourseById(
    id: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
  ): Promise<CommonShowBetaCourse> {
    const course = await this.courseDetailRepository.findAuthoringCourse(id, language);

    if (!course) throw new NotFoundException("adminCourseView.errors.notFound.course");

    if (!canUpdateCourseByAuthor(currentUser, course.authorId)) {
      throw new ForbiddenException("adminCourseView.errors.forbidden.updateCourse");
    }

    const courseChapterList = await this.courseDetailRepository.findAuthoringChapters(id, language);

    const thumbnailS3SingedUrl = course.thumbnailS3Key
      ? await this.courseMediaUrlService.getSignedCourseThumbnailUrl(
          course.thumbnailS3Key,
          IMAGE_QUALITY.SM,
        )
      : null;
    const trailerUrl = await this.courseMediaUrlService.getCourseTrailerUrl(course.id);

    const chaptersWithLessons = await Promise.all(
      courseChapterList.map(async (chapter) => ({
        ...chapter,
        lessons: await this.getAuthoringChapterLessons(chapter.id, language),
      })),
    );

    return {
      ...course,
      thumbnailS3SingedUrl,
      trailerUrl,
      chapters: chaptersWithLessons ?? [],
    };
  }

  async getCourseEmailData(courseId: UUIDType, language?: SupportedLanguages) {
    return this.courseDetailRepository.findCourseEmailData(courseId, language);
  }

  async getChapterName(chapterId: UUIDType, language?: SupportedLanguages) {
    return this.courseDetailRepository.findChapterName(chapterId, language);
  }

  private async getAuthoringChapterLessons(chapterId: UUIDType, language: SupportedLanguages) {
    const lessons: AdminLessonWithContentSchema[] =
      await this.adminChapterRepository.getBetaChapterLessons(chapterId, language);

    const lessonsWithQuizAuthoringContent = await Promise.all(
      lessons.map(async (lesson) => {
        if (lesson.type !== LESSON_TYPES.QUIZ) return lesson;

        const quizLesson = await this.adminLessonService.getQuizLessonForAuthoring(
          lesson.id,
          language,
        );

        if (!quizLesson) throw new NotFoundException("adminCourseView.errors.notFound.lesson");

        return quizLesson;
      }),
    );

    return this.courseLessonMediaService.decorateLessonsForAuthoring(
      lessonsWithQuizAuthoringContent,
    );
  }

  private assertLearnerCanReadCourse(
    course: { status: string; isArchived: boolean },
    isEnrolled: boolean,
    userPermissions: PermissionKey[],
  ) {
    const canReadCatalog = hasPermission(userPermissions, PERMISSIONS.COURSE_READ);
    const canReadEnrolled =
      isEnrolled && hasPermission(userPermissions, PERMISSIONS.COURSE_READ_ASSIGNED);
    const publishedAccess =
      course.status === COURSE_STATUSES.PUBLISHED && (canReadCatalog || canReadEnrolled);
    const privateAccess = course.status === COURSE_STATUSES.PRIVATE && canReadEnrolled;

    if (course.isArchived || (!publishedAccess && !privateAccess)) {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }
  }

  /**
   * A group manager previews a course assigned to their groups unless they also manage courses or
   * are enrolled themselves. Courses outside their scope are hidden unless they can read the
   * catalog.
   */
  private async resolveGroupManagerCoursePreview({
    courseId,
    courseAuthorId,
    currentUser,
  }: {
    courseId: UUIDType;
    courseAuthorId: UUIDType;
    currentUser?: CurrentUserType;
  }): Promise<boolean> {
    if (
      !currentUser ||
      !hasPermission(currentUser.permissions, PERMISSIONS.MANAGED_GROUP_RESULTS_READ)
    ) {
      return false;
    }

    const { permissions, userId } = currentUser;

    const hasCourseManagementAccess =
      hasPermission(permissions, PERMISSIONS.COURSE_UPDATE) ||
      hasPermission(permissions, PERMISSIONS.USER_MANAGE) ||
      (hasPermission(permissions, PERMISSIONS.COURSE_UPDATE_OWN) && userId === courseAuthorId);

    if (hasCourseManagementAccess) return false;

    const canLearn = hasPermission(permissions, PERMISSIONS.LEARNING_PROGRESS_UPDATE);

    const [hasManagedCourseAccess, hasLearnerAccess] = await Promise.all([
      this.courseDetailRepository.isCourseInGroupManagerScope(courseId, currentUser),
      canLearn
        ? this.courseDetailRepository.hasActiveEnrollment(courseId, userId)
        : Promise.resolve(false),
    ]);

    if (
      !hasManagedCourseAccess &&
      !hasLearnerAccess &&
      !hasPermission(permissions, PERMISSIONS.COURSE_READ)
    ) {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }

    return hasManagedCourseAccess && !hasLearnerAccess;
  }

  private async ensureAnonymousCourseAccess(userId?: UUIDType) {
    if (userId) return;

    const globalSettings = await this.settingsService.getPublicGlobalSettings();

    if (!globalSettings.unregisteredUserCoursesAccessibility) {
      throw new NotFoundException("adminCourseView.errors.notFound.course");
    }
  }
}
