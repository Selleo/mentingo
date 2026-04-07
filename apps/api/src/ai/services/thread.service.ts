import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { eq, inArray } from "drizzle-orm";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { hasPermission } from "src/common/permissions/permission.utils";
import { aiMentorThreads } from "src/storage/schema";

import type {
  CreateThreadBody,
  ResponseThreadBody,
  ResponseThreadMessageBody,
} from "src/ai/utils/ai.schema";
import type { BaseResponse, UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

type ThreadViewer = Pick<CurrentUser, "userId" | "permissions">;

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

  async findThread(
    threadId: UUIDType,
    currentUser: ThreadViewer,
  ): Promise<BaseResponse<ResponseThreadBody>> {
    const { userId } = currentUser;

    const thread = await this.aiRepository.findThread([eq(aiMentorThreads.id, threadId)]);

    if (!thread) throw new NotFoundException("Thread not found");

    const { lessonId } = await this.aiRepository.findLessonIdByThreadId(threadId);

    const author = await this.aiRepository.getCourseAuthorByLesson(lessonId);

    const canManageUsers = hasPermission(currentUser.permissions, PERMISSIONS.USER_MANAGE);
    const hasAccess = canManageUsers || author === userId;

    if (!(thread.userId === userId || hasAccess))
      throw new ForbiddenException("You don't have access to this thread");

    return { data: thread };
  }

  async findAllMessagesByThread(
    threadId: UUIDType,
    currentUser: ThreadViewer,
  ): Promise<BaseResponse<ResponseThreadMessageBody[]>> {
    await this.findThread(threadId, currentUser);

    const messages = await this.aiRepository.findMessageHistory(threadId);

    return { data: messages };
  }

  private async findAiMentorLessonIdFromLesson(lessonId: UUIDType) {
    const aiMentorLessonId = await this.aiRepository.findAiMentorLessonIdFromLesson(lessonId);
    if (!aiMentorLessonId) throw new NotFoundException(`Lesson not found`);

    return aiMentorLessonId.aiMentorLessonId;
  }
}
