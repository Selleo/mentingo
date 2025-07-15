import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { LessonService } from "src/lesson/services/lesson.service";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";

import type { CreateThreadBody } from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class ThreadService {
  constructor(
    private readonly aiRepository: AiRepository,
    private readonly lessonService: LessonService,
  ) {}

  async createThreadIfNoneExist(data: CreateThreadBody, role: UserRole) {
    const aiMentorLessonId = await this.findAiMentorLessonIdFromLesson(data.lessonId);
    const lesson = this.lessonService.getLessonById(
      data.lessonId,
      data.userId,
      role === USER_ROLES.STUDENT,
    );

    if (!lesson) throw new NotFoundException("Lesson not found");

    const thread = await this.aiRepository.findThreadByStatusAndAiMentorLessonIdAndUserId(
      [THREAD_STATUS.ACTIVE, THREAD_STATUS.COMPLETED],
      aiMentorLessonId,
      data.userId,
    );

    if (thread) return { thread, newThread: false };

    const newThread = await this.aiRepository.createThread({
      aiMentorLessonId: aiMentorLessonId,
      ...data,
    });

    return { thread: newThread, newThread: true };
  }

  async findThread(threadId: UUIDType, userId: UUIDType) {
    const thread = await this.aiRepository.findThread(threadId);
    if (!thread) throw new NotFoundException("Thread not found");
    if (thread.userId !== userId)
      throw new ForbiddenException("You don't have access to this thread");
    return { data: thread };
  }

  async findAllMessagesByThread(threadId: UUIDType, userId: UUIDType) {
    await this.findThread(threadId, userId);
    const messages = await this.aiRepository.findMessageHistory(threadId);
    return { data: messages };
  }

  async findAllThreadsByLessonIdAndUserId(lessonId: UUIDType, userId: UUIDType) {
    const threads = await this.aiRepository.findThreadsByLessonIdAndUserId(lessonId, userId);
    if (!threads) throw new NotFoundException("No threads found");
    return { data: threads };
  }

  private async findAiMentorLessonIdFromLesson(lessonId: UUIDType) {
    const aiMentorLessonId = await this.aiRepository.findAiMentorLessonIdFromLesson(lessonId);
    if (!aiMentorLessonId) throw new NotFoundException(`Lesson not found`);
    return aiMentorLessonId.aiMentorLessonId;
  }
}
