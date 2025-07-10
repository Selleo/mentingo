import { Injectable, NotFoundException } from "@nestjs/common";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiService } from "src/ai/services/ai.service";
import { TokenService } from "src/ai/services/token.service";
import { LessonService } from "src/lesson/services/lesson.service";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";

import type { CreateThreadBody } from "src/ai/ai.schema";

@Injectable()
export class ThreadService {
  constructor(
    private tokenService: TokenService,
    private aiRepository: AiRepository,
    private lessonService: LessonService,
    private aiService: AiService,
  ) {}

  async createThread(data: CreateThreadBody, role: UserRole) {
    const aiMentorLessonId = await this.aiRepository.getAiMentorLessonIdFromLesson(data.lessonId);
    if (!aiMentorLessonId) throw new NotFoundException(`Lesson not found`);

    const thread = await this.aiRepository.createThread({
      aiMentorLessonId: aiMentorLessonId.aiMentorLessonId,
      ...data,
    });

    const lesson = this.lessonService.getLessonById(
      data.lessonId,
      data.userId,
      role === USER_ROLES.STUDENT,
    );
    if (!lesson) throw new NotFoundException("Lesson not found");

    const systemPrompt = await this.aiService.setSystemPrompt(thread.id);
    await this.aiService.sendWelcomeMessage(thread.id, systemPrompt);

    return { data: thread };
  }
}
