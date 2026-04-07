import { BadRequestException, Injectable } from "@nestjs/common";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { ChatService } from "src/ai/services/chat.service";
import { MessageService } from "src/ai/services/message.service";
import { PromptService } from "src/ai/services/prompt.service";
import { ThreadService } from "src/ai/services/thread.service";
import { MESSAGE_ROLE, THREAD_STATUS } from "src/ai/utils/ai.type";

import type { PermissionKey } from "@repo/shared";
import type { ThreadOwnershipBody } from "src/ai/utils/ai.schema";

type JudgeViewer = {
  userId: string;
  permissions: PermissionKey[];
};

@Injectable()
export class JudgeService {
  constructor(
    private readonly aiRepository: AiRepository,
    private readonly chatService: ChatService,
    private readonly threadService: ThreadService,
    private readonly messageService: MessageService,
    private readonly promptService: PromptService,
  ) {}

  async runJudge(data: ThreadOwnershipBody, viewer: JudgeViewer) {
    const thread = await this.threadService.findThread(data.threadId, {
      userId: viewer.userId,
      permissions: viewer.permissions,
    });

    if (thread.data.status !== THREAD_STATUS.ACTIVE)
      throw new BadRequestException("Thread must be active");

    const mentorLesson = await this.aiRepository.findMentorLessonByThreadId(
      data.threadId,
      thread.data.userLanguage,
    );

    const messages = await this.messageService.findMessageHistory(
      data.threadId,
      undefined,
      MESSAGE_ROLE.USER,
    );

    const content = messages.history.map(({ content }) => content).join("\n");
    const system = await this.promptService.loadPrompt("judgePrompt", {
      lessonTitle: mentorLesson.title,
      language: messages.userLanguage,
      lessonInstructions: mentorLesson.instructions,
      lessonConditions: mentorLesson.conditions,
    });
    const judged = await this.chatService.judge(system, content);

    const { status } = await this.aiRepository.updateThread(data.threadId, {
      status: THREAD_STATUS.COMPLETED,
    });

    return { data: { ...judged, status } };
  }
}
