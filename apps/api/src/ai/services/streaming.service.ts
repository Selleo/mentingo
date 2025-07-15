import { openai } from "@ai-sdk/openai";
import { Injectable } from "@nestjs/common";
import { type Message, streamText } from "ai";

import { AiService } from "src/ai/services/ai.service";
import { ChatService } from "src/ai/services/chat.service";
import { MessageService } from "src/ai/services/message.service";
import { PromptService } from "src/ai/services/prompt.service";
import { SummaryService } from "src/ai/services/summary.service";
import { TokenService } from "src/ai/services/token.service";
import { MAX_TOKENS } from "src/ai/utils/ai.constants";
import { MESSAGE_ROLE, type OpenAIModels } from "src/ai/utils/ai.type";

import type { StreamChatBody } from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class StreamingService {
  constructor(
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
    private readonly messageService: MessageService,
    private readonly summaryService: SummaryService,
    private readonly tokenService: TokenService,
    private readonly chatService: ChatService,
  ) {}

  async streamMessage(data: StreamChatBody, model: OpenAIModels, userId: UUIDType) {
    await this.aiService.isThreadActive(data.threadId, userId);
    await this.summaryService.summarizeIfNeeded(data.threadId);

    const prompt = await this.promptService.buildPrompt(data.threadId, data.content, data.id);

    const result = streamText({
      model: openai(model),
      messages: prompt.map((m) => ({
        content: m.content,
        role: this.chatService.mapRole(m.role),
      })) as Omit<Message, "id">[],
      maxTokens: MAX_TOKENS,
      onFinish: async (event) => {
        const mentorTokenCount = this.tokenService.countTokens(model, event.text);
        const userTokenCount = this.tokenService.countTokens(model, data.content);

        await this.messageService.createMessages(
          {
            ...data,
            role: MESSAGE_ROLE.USER,
            tokenCount: userTokenCount,
          },
          {
            content: event.text,
            role: MESSAGE_ROLE.MENTOR,
            threadId: data.threadId,
            tokenCount: mentorTokenCount,
          },
        );
      },
    });

    return result;
  }
}
