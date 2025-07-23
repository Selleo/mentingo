import { BadRequestException, Injectable } from "@nestjs/common";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { ChatService } from "src/ai/services/chat.service";
import { MessageService } from "src/ai/services/message.service";
import { ThreadService } from "src/ai/services/thread.service";
import { SYSTEM_PROMPT_FOR_JUDGE } from "src/ai/utils/ai.config";
import { MESSAGE_ROLE, THREAD_STATUS } from "src/ai/utils/ai.type";

import type { ThreadOwnershipBody } from "src/ai/utils/ai.schema";

@Injectable()
export class JudgeService {
  constructor(
    private readonly aiRepository: AiRepository,
    private readonly chatService: ChatService,
    private readonly threadService: ThreadService,
    private readonly messageService: MessageService,
  ) {}

  async runJudge(data: ThreadOwnershipBody) {
    const thread = await this.threadService.findThread(data.threadId, data.userId);
    if (thread.data.status !== THREAD_STATUS.ACTIVE)
      throw new BadRequestException("Thread must be active");

    const mentorLesson = await this.aiRepository.findMentorLessonByThreadId(data.threadId);

    const messages = await this.messageService.findMessageHistory(
      data.threadId,
      undefined,
      MESSAGE_ROLE.USER,
    );

    const content = messages.history.map(({ content }) => content).join("\n");

    const system = SYSTEM_PROMPT_FOR_JUDGE(mentorLesson, messages.userLanguage);

    const judged = await this.chatService.judge(system, content);
    const { status } = await this.aiRepository.updateThread(data.threadId, {
      status: THREAD_STATUS.COMPLETED,
    });

    return { data: { ...judged, status } };
  }
}
