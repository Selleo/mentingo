import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { eq, inArray } from "drizzle-orm";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { aiMentorThreads } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { CreateThreadBody } from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class ThreadService {
  constructor(private readonly aiRepository: AiRepository) {}

  async createThreadIfNoneExist(data: CreateThreadBody) {
    const aiMentorLessonId = await this.findAiMentorLessonIdFromLesson(data.lessonId);

    const thread = await this.aiRepository.findThread([
      eq(aiMentorThreads.aiMentorLessonId, aiMentorLessonId),
      inArray(aiMentorThreads.status, [THREAD_STATUS.ACTIVE, THREAD_STATUS.COMPLETED]),
      eq(aiMentorThreads.userId, data.userId),
    ]);

    if (thread) return { thread, newThread: false };

    const newThread = await this.aiRepository.createThread({
      aiMentorLessonId: aiMentorLessonId,
      ...data,
    });

    return { thread: newThread, newThread: true };
  }

  async findThread(threadId: UUIDType, userId: UUIDType, userRole: UserRole = USER_ROLES.STUDENT) {
    const thread = await this.aiRepository.findThread([eq(aiMentorThreads.id, threadId)]);

    if (!thread) throw new NotFoundException("Thread not found");

    const { lessonId } = await this.aiRepository.findLessonIdByThreadId(threadId);

    const author = await this.aiRepository.getCourseAuthorByLesson(lessonId);

    const hasAccess = userRole === USER_ROLES.ADMIN || author === userId;

    if (!(thread.userId === userId || hasAccess))
      throw new ForbiddenException("You don't have access to this thread");

    return { data: thread };
  }

  async findAllMessagesByThread(threadId: UUIDType, userId: UUIDType, userRole: UserRole) {
    await this.findThread(threadId, userId, userRole);
    const messages = await this.aiRepository.findMessageHistory(threadId);

    return { data: messages };
  }

  private async findAiMentorLessonIdFromLesson(lessonId: UUIDType) {
    const aiMentorLessonId = await this.aiRepository.findAiMentorLessonIdFromLesson(lessonId);
    if (!aiMentorLessonId) throw new NotFoundException(`Lesson not found`);

    return aiMentorLessonId.aiMentorLessonId;
  }
}
