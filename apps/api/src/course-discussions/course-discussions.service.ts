import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { CourseDiscussionsRepository } from "./course-discussions.repository";
import { sanitizeDiscussionText } from "./course-discussions.utils";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseDiscussionsService {
  constructor(private readonly repo: CourseDiscussionsRepository) {}

  async list(courseId: UUIDType, user: CurrentUserType) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    if (!(await this.repo.canAccessCourse(courseId, user))) throw new ForbiddenException();
    return this.repo.listThreads(courseId);
  }

  async create(
    courseId: UUIDType,
    user: CurrentUserType,
    data: { title: string; content: string },
  ) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    if (!(await this.repo.canAccessCourse(courseId, user))) throw new ForbiddenException();
    return this.repo.createThread(courseId, user.userId, {
      title: sanitizeDiscussionText(data.title),
      content: sanitizeDiscussionText(data.content),
    });
  }

  async listLesson(courseId: UUIDType, lessonId: UUIDType, user: CurrentUserType) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    if (!(await this.repo.canAccessCourse(courseId, user))) throw new ForbiddenException();
    if (!(await this.repo.lessonBelongsToCourse(courseId, lessonId)))
      throw new NotFoundException("Lesson not found");
    return this.repo.listLessonThreads(courseId, lessonId);
  }

  async createLesson(
    courseId: UUIDType,
    lessonId: UUIDType,
    user: CurrentUserType,
    data: { title: string; content: string },
  ) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    if (!(await this.repo.canAccessCourse(courseId, user))) throw new ForbiddenException();
    if (!(await this.repo.lessonBelongsToCourse(courseId, lessonId)))
      throw new NotFoundException("Lesson not found");
    return this.repo.createLessonThread(courseId, lessonId, user.userId, {
      title: sanitizeDiscussionText(data.title),
      content: sanitizeDiscussionText(data.content),
    });
  }
}
