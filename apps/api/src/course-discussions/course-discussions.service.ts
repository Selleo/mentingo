import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CourseDiscussionsRepository } from "./course-discussions.repository";
import {
  applyCommentVisibility,
  applyThreadVisibility,
  sanitizeDiscussionText,
} from "./course-discussions.utils";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class CourseDiscussionsService {
  constructor(private readonly repo: CourseDiscussionsRepository) {}

  async list(courseId: UUIDType, user: CurrentUserType) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    if (!(await this.repo.canAccessCourse(courseId, user))) throw new ForbiddenException();
    const canModerate = await this.repo.canModerateCourse(courseId, user);
    return (await this.repo.listThreads(courseId)).map((thread) =>
      applyThreadVisibility(thread, canModerate),
    );
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
    const canModerate = await this.repo.canModerateCourse(courseId, user);
    return (await this.repo.listLessonThreads(courseId, lessonId)).map((thread) =>
      applyThreadVisibility(thread, canModerate),
    );
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
    const canModerate = await this.repo.canModerateCourse(thread.courseId, user);
    const detail = await this.repo.getThreadDetail(threadId);
    if (!detail) throw new NotFoundException();
    return {
      ...applyThreadVisibility(detail, canModerate),
      comments: detail.comments.map((comment) => applyCommentVisibility(comment, canModerate)),
    };
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

  async moderateThread(threadId: UUIDType, user: CurrentUserType, data: { hidden: boolean }) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    const thread = await this.repo.findThreadById(threadId);
    if (!thread) throw new NotFoundException();
    if (thread.status === "deleted_by_author") throw new ConflictException("deleted_by_author");
    if (!(await this.repo.canModerateCourse(thread.courseId, user))) throw new ForbiddenException();
    return this.repo.moderateThread(threadId, user.userId, data);
  }

  async moderateComment(commentId: UUIDType, user: CurrentUserType, data: { hidden: boolean }) {
    if (!(await this.repo.isCohortLearningEnabled())) throw new ForbiddenException();
    const comment = await this.repo.findCommentById(commentId);
    if (!comment) throw new NotFoundException();
    if (comment.status === "deleted_by_author") throw new ConflictException("deleted_by_author");
    const thread = await this.repo.findThreadById(comment.threadId);
    if (!thread) throw new NotFoundException();
    if (!(await this.repo.canModerateCourse(thread.courseId, user))) throw new ForbiddenException();
    return this.repo.moderateComment(commentId, user.userId, data);
  }
}
