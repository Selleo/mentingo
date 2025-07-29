import { Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { MessageService } from "src/ai/services/message.service";
import { TokenService } from "src/ai/services/token.service";
import { SYSTEM_PROMPT_FOR_MENTOR } from "src/ai/utils/ai.config";
import { MESSAGE_ROLE, OPENAI_MODELS } from "src/ai/utils/ai.type";
import { aiMentorThreads } from "src/storage/schema";

import type { ThreadOwnershipBody } from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class PromptService {
  constructor(
    private readonly aiRepository: AiRepository,
    private readonly messageService: MessageService,
    private readonly tokenService: TokenService,
  ) {}

  async buildPrompt(threadId: UUIDType, content: string, tempMessageId?: string) {
    const { history } = await this.messageService.findMessageHistory(threadId, false);

    const systemPrompt = await this.aiRepository.findFirstMessageByRoleAndThread(
      threadId,
      MESSAGE_ROLE.SYSTEM,
    );

    const summary = await this.aiRepository.findFirstMessageByRoleAndThread(
      threadId,
      MESSAGE_ROLE.SUMMARY,
    );

    if (summary)
      history.unshift({
        id: summary.id,
        role: summary.role,
        content: summary.content,
      });

    if (systemPrompt)
      history.unshift({
        id: systemPrompt.id,
        role: systemPrompt.role,
        content: systemPrompt.content,
      });

    history.push({ id: tempMessageId ?? "", role: MESSAGE_ROLE.USER, content });

    return history;
  }

  async setSystemPrompt(data: ThreadOwnershipBody) {
    const { userLanguage } = await this.aiRepository.findThread([
      eq(aiMentorThreads.id, data.threadId),
    ]);

    const { title, instructions } = await this.aiRepository.findMentorLessonByThreadId(
      data.threadId,
    );

    const groups = await this.aiRepository.findGroupsByThreadId(data.threadId);

    const systemPrompt = SYSTEM_PROMPT_FOR_MENTOR({ title, instructions }, groups, userLanguage);
    const tokenCount = this.tokenService.countTokens(OPENAI_MODELS.BASIC, systemPrompt);

    await this.aiRepository.insertMessage({
      tokenCount,
      threadId: data.threadId,
      role: MESSAGE_ROLE.SYSTEM,
      content: systemPrompt,
    });

    return systemPrompt;
  }

  async isNotEmpty(prompt: string) {
    if (!prompt?.trim()) {
      throw new Error("Prompt cannot be empty");
    }
  }
}
