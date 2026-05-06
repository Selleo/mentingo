import { Inject, Injectable } from "@nestjs/common";
import {
  COURSE_ENROLLMENT,
  LEARNING_PATH_ENROLLMENT_TYPES,
  LEARNING_PATH_PROGRESS_STATUSES,
} from "@repo/shared";

import { DatabasePg, type UUIDType } from "src/common";
import { CourseService } from "src/courses/course.service";

import { LearningPathRepository } from "../learning-path.repository";

import { LearningPathCertificateService } from "./learning-path-certificate.service";

import type { LearningPathCourseLink } from "../learning-path.types";

const PATH_LINK_ENROLLMENT_TIME_TOLERANCE_MS = 1000;

@Injectable()
export class LearningPathCourseSyncService {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly learningPathRepository: LearningPathRepository,
    private readonly courseService: CourseService,
    private readonly learningPathCertificateService: LearningPathCertificateService,
  ) {}

  async syncLearningPathEnrollments(learningPathId: string) {
    const learningPath = await this.learningPathRepository.findLearningPathById(
      learningPathId,
      this.db,
    );

    if (!learningPath) return;

    const [studentIds, courseLinks] = await Promise.all([
      this.learningPathRepository.getLearningPathStudentIds(learningPathId, this.db),
      this.learningPathRepository.getLearningPathCourses(learningPathId, this.db),
    ]);

    if (!studentIds.length) return;

    if (!courseLinks.length) {
      await Promise.all(
        studentIds.map((studentId) => this.clearLearningPathEnrollment(learningPathId, studentId)),
      );

      return;
    }

    for (const studentId of studentIds) {
      await this.syncStudentLearningPath(
        learningPathId,
        studentId,
        courseLinks,
        learningPath.sequenceEnabled,
      );
    }
  }

  async syncStudentLearningPathsForFinishedCourse(studentId: string, courseId: string) {
    const pathIds = await this.learningPathRepository.getLearningPathIdsForStudentCourse(
      studentId,
      courseId,
      this.db,
    );

    for (const { learningPathId } of pathIds) {
      await this.syncStudentLearningPath(learningPathId, studentId);
    }
  }

  async syncLearningPathEnrollmentsForGroupMember(
    groupId: string,
    studentId: string,
    tenantId: string,
  ) {
    const pathIds = await this.learningPathRepository.getLearningPathIdsByGroupId(groupId, this.db);

    for (const { learningPathId } of pathIds) {
      const newStudentIds = await this.learningPathRepository.getNotEnrolledUserIds(
        learningPathId,
        [studentId],
        this.db,
      );

      if (newStudentIds.length) {
        const courseIds = await this.learningPathRepository.getLearningPathCourseIds(
          learningPathId,
          this.db,
        );

        await this.learningPathRepository.insertStudentLearningPaths(
          learningPathId,
          newStudentIds,
          LEARNING_PATH_ENROLLMENT_TYPES.GROUP,
          tenantId,
          this.db,
        );
        await this.learningPathRepository.insertStudentLearningPathCourses(
          learningPathId,
          newStudentIds,
          courseIds,
          tenantId,
          this.db,
        );
      }

      await this.syncStudentLearningPath(learningPathId, studentId);
    }
  }

  async removeLearningPathCourseAccess(
    learningPathId: string,
    studentIds: string[],
    dbInstance: DatabasePg = this.db,
  ) {
    for (const studentId of studentIds) {
      await this.clearLearningPathEnrollment(learningPathId, studentId, dbInstance);
    }
  }

  private async syncStudentLearningPath(
    learningPathId: string,
    studentId: string,
    courseLinks?: LearningPathCourseLink[],
    sequenceEnabled?: boolean,
  ) {
    const learningPath =
      sequenceEnabled === undefined
        ? await this.learningPathRepository.findLearningPathById(learningPathId, this.db)
        : null;
    const currentCourseLinks =
      courseLinks ??
      (await this.learningPathRepository.getLearningPathCourses(learningPathId, this.db));
    const shouldUseSequence = sequenceEnabled ?? learningPath?.sequenceEnabled ?? false;

    const [studentCourseRows, existingPathLinks] = await Promise.all([
      this.learningPathRepository.getStudentCourseProgressByCourseIds(
        studentId,
        currentCourseLinks.map(({ courseId }) => courseId),
        this.db,
      ),
      this.learningPathRepository.getStudentLearningPathCourseLinks(
        learningPathId,
        studentId,
        this.db,
      ),
    ]);

    const existingPathCourseIds = new Set(existingPathLinks.map(({ courseId }) => courseId));
    const currentPathCourseIds = new Set(currentCourseLinks.map(({ courseId }) => courseId));

    const removedCourseIds = [...existingPathCourseIds].filter(
      (courseId) => !currentPathCourseIds.has(courseId),
    );
    const addedCourseIds = currentCourseLinks
      .map(({ courseId }) => courseId)
      .filter((courseId) => !existingPathCourseIds.has(courseId));

    if (removedCourseIds.length) {
      await this.removeStudentLearningPathCourseLinks(
        learningPathId,
        studentId,
        removedCourseIds,
        this.db,
      );
    }

    const insertedPathLinks = await this.addStudentLearningPathCourseLinks(
      learningPathId,
      studentId,
      addedCourseIds,
    );
    const activePathLinks = existingPathLinks
      .filter(({ courseId }) => currentPathCourseIds.has(courseId))
      .concat(insertedPathLinks);

    await this.syncStudentCourseEnrollments(
      learningPathId,
      studentId,
      currentCourseLinks,
      activePathLinks,
      studentCourseRows,
      shouldUseSequence,
    );

    await this.recalculateStudentLearningPathProgress(learningPathId, studentId);
  }

  private async addStudentLearningPathCourseLinks(
    learningPathId: string,
    studentId: string,
    courseIds: string[],
  ) {
    return this.learningPathRepository.insertStudentLearningPathCourseLinks(
      learningPathId,
      studentId,
      courseIds,
      this.db,
    );
  }

  private async removeStudentLearningPathCourseLinks(
    learningPathId: string,
    studentId: string,
    courseIds: string[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (!courseIds.length) return;

    const removedLinks = await this.learningPathRepository.deleteStudentLearningPathCourseLinks(
      learningPathId,
      studentId,
      courseIds,
      dbInstance,
    );
    const removableCourseIds = await this.resolveRemovableCourseIds(
      learningPathId,
      studentId,
      removedLinks,
      false,
      dbInstance,
    );

    if (!removableCourseIds.length) return;

    await this.courseService.markStudentCoursesNotEnrolled(
      studentId,
      removableCourseIds,
      dbInstance,
    );
  }

  private async syncStudentCourseEnrollments(
    learningPathId: string,
    studentId: string,
    courseLinks: LearningPathCourseLink[],
    pathLinks: Array<{ courseId: UUIDType; createdAt: string }>,
    studentCourseRows: Array<{ courseId: string; progress: string; completedAt: string | null }>,
    sequenceEnabled: boolean,
  ) {
    const progressByCourseId = new Map(studentCourseRows.map((row) => [row.courseId, row]));
    const pathLinkCreatedAtByCourseId = new Map(
      pathLinks.map(({ courseId, createdAt }) => [courseId, createdAt]),
    );

    let locked = false;

    for (const courseLink of courseLinks) {
      const courseProgress = progressByCourseId.get(courseLink.courseId);
      const isCompleted = courseProgress?.completedAt != null;
      const shouldEnroll = !sequenceEnabled || !locked || isCompleted;

      if (shouldEnroll) {
        await this.enrollStudentCourse(studentId, courseLink.courseId);
        await this.courseService.createCourseDependencies(
          courseLink.courseId,
          studentId,
          null,
          this.db,
        );
      } else {
        await this.unenrollStudentCourse(
          learningPathId,
          studentId,
          courseLink.courseId,
          pathLinkCreatedAtByCourseId.get(courseLink.courseId),
        );
      }

      if (sequenceEnabled && !isCompleted) {
        locked = true;
      }
    }
  }

  private async resolveRemovableCourseIds(
    learningPathId: string,
    studentId: string,
    pathLinks: Array<{ courseId: string; createdAt?: string }>,
    includeMissingEnrollment: boolean,
    dbInstance: DatabasePg = this.db,
  ) {
    const courseIds = pathLinks.map(({ courseId }) => courseId);

    if (!courseIds.length) return [];

    const [otherPathCourseIds, courseEnrollments] = await Promise.all([
      this.learningPathRepository.getCourseIdsWithOtherLearningPathAccess(
        learningPathId,
        studentId,
        courseIds,
        dbInstance,
      ),
      this.courseService.getStudentCourseEnrollments(studentId, courseIds, dbInstance),
    ]);
    const courseIdsWithOtherPathAccess = new Set(otherPathCourseIds);
    const enrollmentByCourseId = new Map(
      courseEnrollments.map((enrollment) => [enrollment.courseId, enrollment]),
    );

    return pathLinks
      .filter(({ courseId, createdAt }) => {
        if (courseIdsWithOtherPathAccess.has(courseId)) return false;

        const enrollment = enrollmentByCourseId.get(courseId);
        if (!enrollment) return includeMissingEnrollment;

        return !this.isEnrollmentGrantedOutsidePath(enrollment, createdAt);
      })
      .map(({ courseId }) => courseId);
  }

  private isEnrollmentGrantedOutsidePath(
    enrollment: {
      enrolledAt: string | null;
      enrolledByGroupId: string | null;
      status: string;
    },
    pathLinkCreatedAt?: string,
  ) {
    if (enrollment.status !== COURSE_ENROLLMENT.ENROLLED) return false;
    if (enrollment.enrolledByGroupId) return true;
    if (!enrollment.enrolledAt || !pathLinkCreatedAt) return false;

    const enrolledAt = new Date(enrollment.enrolledAt).getTime();
    const linkedAt = new Date(pathLinkCreatedAt).getTime();

    return enrolledAt < linkedAt || enrolledAt - linkedAt > PATH_LINK_ENROLLMENT_TIME_TOLERANCE_MS;
  }

  private async enrollStudentCourse(studentId: string, courseId: string) {
    const [existingEnrollment] = await this.courseService.getStudentCourseEnrollments(
      studentId,
      [courseId],
      this.db,
    );

    if (existingEnrollment?.status === COURSE_ENROLLMENT.ENROLLED) {
      return;
    }

    if (existingEnrollment?.enrolledByGroupId) {
      await this.courseService.activateStudentCourseEnrollment(courseId, studentId, this.db);

      return;
    }

    await this.courseService.createStudentCourse(courseId, studentId, null, null, this.db);
  }

  private async unenrollStudentCourse(
    learningPathId: string,
    studentId: string,
    courseId: string,
    pathLinkCreatedAt?: string,
  ) {
    const removableCourseIds = await this.resolveRemovableCourseIds(
      learningPathId,
      studentId,
      [{ courseId, createdAt: pathLinkCreatedAt }],
      true,
    );

    if (!removableCourseIds.length) return;

    await this.courseService.markStudentCoursesNotEnrolled(studentId, removableCourseIds, this.db);
  }

  private async clearLearningPathEnrollment(
    learningPathId: string,
    studentId: string,
    dbInstance: DatabasePg = this.db,
  ) {
    const existingPathLinks = await this.learningPathRepository.getStudentLearningPathCourseLinks(
      learningPathId,
      studentId,
      dbInstance,
    );

    if (!existingPathLinks.length) return;

    await this.removeStudentLearningPathCourseLinks(
      learningPathId,
      studentId,
      existingPathLinks.map(({ courseId }) => courseId),
      dbInstance,
    );
  }

  private async recalculateStudentLearningPathProgress(learningPathId: string, studentId: string) {
    const learningPath = await this.learningPathRepository.findLearningPathById(
      learningPathId,
      this.db,
    );
    const progressState = await this.learningPathRepository.getLearningPathProgressState(
      learningPathId,
      studentId,
      this.db,
    );

    const completedCourses = progressState.studentCourseProgressRows.filter(
      (row) => row.completedAt != null,
    );

    await this.learningPathRepository.updateStudentLearningPathProgress(
      learningPathId,
      studentId,
      this.resolveLearningPathProgress(progressState.courses.length, completedCourses.length),
      this.resolveLearningPathCompletedAt(progressState.courses.length, completedCourses),
      this.db,
    );

    if (
      learningPath?.includesCertificate &&
      progressState.courses.length > 0 &&
      completedCourses.length === progressState.courses.length
    ) {
      const existingCertificate =
        await this.learningPathRepository.findLearningPathCertificateByUserAndPath(
          studentId,
          learningPathId,
          this.db,
        );

      if (!existingCertificate) {
        await this.learningPathCertificateService.createLearningPathCertificate(
          studentId,
          learningPathId,
          this.db,
        );
      }
    }
  }

  private resolveLearningPathProgress(totalCourses: number, completedCourses: number) {
    if (totalCourses === 0 || completedCourses === 0) {
      return LEARNING_PATH_PROGRESS_STATUSES.NOT_STARTED;
    }

    if (totalCourses === completedCourses) {
      return LEARNING_PATH_PROGRESS_STATUSES.COMPLETED;
    }

    return LEARNING_PATH_PROGRESS_STATUSES.IN_PROGRESS;
  }

  private resolveLearningPathCompletedAt(
    totalCourses: number,
    completedCourses: Array<{ completedAt: string | null }>,
  ) {
    if (totalCourses === 0 || completedCourses.length !== totalCourses) return null;

    return (
      completedCourses
        .map(({ completedAt }) => completedAt)
        .filter((completedAt): completedAt is string => completedAt !== null)
        .sort()
        .at(-1) ?? null
    );
  }
}
