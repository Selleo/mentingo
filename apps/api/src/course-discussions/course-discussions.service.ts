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

  async detail(threadId: UUIDType, user: CurrentUserType) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    const thread = await this.repo.findThreadById(threadId);
    if (!thread) throw new NotFoundException();
    if (!(await this.repo.canAccessCourse(thread.courseId, user))) throw new ForbiddenException();
    return this.repo.getThreadDetail(threadId);
  }

  async updateThread(
    threadId: UUIDType,
    user: CurrentUserType,
    data: { title?: string; content?: string },
  ) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    const thread = await this.repo.findThreadById(threadId);
    if (!thread) throw new NotFoundException();
    if (!(await this.repo.canAccessCourse(thread.courseId, user))) throw new ForbiddenException();
    if (thread.authorId !== user.userId) throw new ForbiddenException();
    return this.repo.updateThread(threadId, {
      title: data.title !== undefined ? sanitizeDiscussionText(data.title) : undefined,
      content: data.content !== undefined ? sanitizeDiscussionText(data.content) : undefined,
    });
  }

  async deleteThread(threadId: UUIDType, user: CurrentUserType) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    const thread = await this.repo.findThreadById(threadId);
    if (!thread) throw new NotFoundException();
    if (!(await this.repo.canAccessCourse(thread.courseId, user))) throw new ForbiddenException();
    if (thread.authorId !== user.userId) throw new ForbiddenException();
    return this.repo.softDeleteThread(threadId, user.userId);
  }

  async createComment(threadId: UUIDType, user: CurrentUserType, data: { content: string }) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    const thread = await this.repo.findThreadById(threadId);
    if (!thread) throw new NotFoundException();
    if (!(await this.repo.canAccessCourse(thread.courseId, user))) throw new ForbiddenException();
    const [comment] = await this.repo.createComment(threadId, user.userId, {
      content: sanitizeDiscussionText(data.content),
    });
    await this.repo.updateThreadLastActivity(threadId);
    return comment;
  }

  async updateComment(commentId: UUIDType, user: CurrentUserType, data: { content: string }) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    const comment = await this.repo.findCommentById(commentId);
    if (!comment) throw new NotFoundException();
    const thread = await this.repo.findThreadById(comment.threadId);
    if (!thread) throw new NotFoundException();
    if (!(await this.repo.canAccessCourse(thread.courseId, user))) throw new ForbiddenException();
    if (comment.authorId !== user.userId) throw new ForbiddenException();
    return this.repo.updateComment(commentId, { content: sanitizeDiscussionText(data.content) });
  }

  async deleteComment(commentId: UUIDType, user: CurrentUserType) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    const comment = await this.repo.findCommentById(commentId);
    if (!comment) throw new NotFoundException();
    const thread = await this.repo.findThreadById(comment.threadId);
    if (!thread) throw new NotFoundException();
    if (!(await this.repo.canAccessCourse(thread.courseId, user))) throw new ForbiddenException();
    if (comment.authorId !== user.userId) throw new ForbiddenException();
    return this.repo.softDeleteComment(commentId, user.userId);
  }
}
