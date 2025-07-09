import { Injectable, NotFoundException } from "@nestjs/common";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { TokenService } from "src/ai/services/token.service";

// import { LessonService } from "src/lesson/services/lesson.service";
import type { ThreadBody } from "src/ai/ai.schema";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class ThreadService {
  constructor(
    private tokenService: TokenService,
    private aiRepository: AiRepository,
    // private lessonService: LessonService,
  ) {}

  async createThread(data: ThreadBody, role: UserRole) {
    const [lessonId] = await this.aiRepository.getLessonIdFromMentorLesson(data.aiMentorLessonId);
    if (!lessonId) throw new NotFoundException(`Lesson not found temp: ${role}`);

    // const lesson = this.lessonService.getLessonById(lessonId.lessonId, data.userId, role === USER_ROLES.STUDENT);
    // if (!lesson) throw new NotFoundException("Lesson not found");

    return { data: await this.aiRepository.createThread(data) };
  }
}
