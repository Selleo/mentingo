import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiService } from "src/ai/services/ai.service";
import { LessonService } from "src/lesson/services/lesson.service";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";

import type { CreateThreadBody } from "src/ai/ai.schema";
import type { ThreadStatus } from "src/ai/ai.type";
import type { UUIDType } from "src/common";

@Injectable()
export class ThreadService {
  constructor(
    private aiRepository: AiRepository,
    private lessonService: LessonService,
    private aiService: AiService,
  ) {}

  async createThread(data: CreateThreadBody, role: UserRole) {
    const aiMentorLessonId = await this.aiRepository.getAiMentorLessonIdFromLesson(data.lessonId);
    if (!aiMentorLessonId) throw new NotFoundException(`Lesson not found`);

    const lesson = this.lessonService.getLessonById(
      data.lessonId,
      data.userId,
      role === USER_ROLES.STUDENT,
    );

    if (!lesson) throw new NotFoundException("Lesson not found");

    const thread = await this.aiRepository.createThread({
      aiMentorLessonId: aiMentorLessonId.aiMentorLessonId,
      ...data,
    });

    const systemPrompt = await this.aiService.setSystemPrompt(thread.id);
    await this.aiService.sendWelcomeMessage(thread.id, systemPrompt);

    return { data: thread };
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

  // will be used in exiting lesson and marking as completed
  async setThreadStatus(threadId: UUIDType, userId: UUIDType, status: ThreadStatus) {
    const thread = await this.findThread(threadId, userId);
    return await this.aiRepository.updateThread(threadId, { ...thread.data, status });
  }
}
