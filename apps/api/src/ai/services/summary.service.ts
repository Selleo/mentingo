import { Injectable } from "@nestjs/common";

import { THRESHOLD } from "src/ai/ai.constants";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { ChatService } from "src/ai/services/chat.service";
import { MessageService } from "src/ai/services/message.service";
import { TokenService } from "src/ai/services/token.service";
import { SUMMARY_PROMPT } from "src/ai/utils/ai.config";
import { MESSAGE_ROLE, type MessageRole, OPENAI_MODELS } from "src/ai/utils/ai.type";

import type { UUIDType } from "src/common";

@Injectable()
export class SummaryService {
  constructor(
    private readonly aiRepository: AiRepository,
    private readonly chatService: ChatService,
    private readonly tokenService: TokenService,
    private readonly messageService: MessageService,
  ) {}

  async summarizeThreadOnTokenThreshold(threadId: UUIDType) {
    const tokens = await this.aiRepository.getTokenSumForThread(threadId, false);

    if (Number(tokens.total) > THRESHOLD) {
      await this.summarize(threadId);
    }
  }

  private async upsertThreadSummaryMessage(
    threadId: UUIDType,
    content: string,
    tokenCount: number,
  ) {
    const exists = await this.aiRepository.findFirstMessageByRoleAndThread(
      threadId,
      MESSAGE_ROLE.SUMMARY,
    );

    if (exists) {
      await this.aiRepository.updateSummary(threadId, content, tokenCount);
    } else {
      await this.aiRepository.insertMessage({
        role: MESSAGE_ROLE.SUMMARY,
        content,
        threadId,
        tokenCount,
      });
    }
  }

  private async summarize(threadId: UUIDType) {
    const { history, userLanguage } = await this.messageService.findMessageHistory(threadId, false);

    const mappedHistory = history
      .map((msg: { role: MessageRole; content: string }) => `${msg.role}: ${msg.content}`)
      .join("\n");

    const summaryPrompt = SUMMARY_PROMPT(mappedHistory, userLanguage);
    const summarized = await this.chatService.generatePrompt(summaryPrompt, OPENAI_MODELS.BASIC);
    const tokenCount = this.tokenService.countTokens(OPENAI_MODELS.BASIC, summarized);

    await this.aiRepository.archiveMessages(threadId);
    await this.upsertThreadSummaryMessage(threadId, summarized, tokenCount);

    return summarized;
  }
}
