import { BadRequestException, Injectable } from "@nestjs/common";

import { SUMMARY_PROMPT, THRESHOLD } from "src/ai/ai.config";
import {
  MESSAGE_ROLE,
  OPENAI_MODELS,
  type OpenAIModels,
  type SupportedLanguages,
  THREAD_STATUS,
} from "src/ai/ai.type";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { ChatService } from "src/ai/services/chat.service";
import { TokenService } from "src/ai/services/token.service";

import type { CreateThreadMessageBody } from "src/ai/ai.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class AiService {
  constructor(
    private readonly chatService: ChatService,
    private readonly tokenService: TokenService,
    private readonly aiRepository: AiRepository,
  ) {}

  // make this method shorter
  async generateMessage(data: CreateThreadMessageBody, model: OpenAIModels) {
    const status = await this.aiRepository.getThreadStatus(data.threadId);
    if (status.status !== THREAD_STATUS.ACTIVE)
      throw new BadRequestException("Thread must be active");

    const tokens = await this.aiRepository.getTokenSumForThread(data.threadId, false);

    if (Number(tokens.total) > THRESHOLD) {
      await this.summarize(data.threadId);
    }

    const savedMessages = await this.aiRepository.getMessageHistory(data.threadId, false);

    let systemPrompt = await this.aiRepository.findFirstMessageByRoleAndThread(
      data.threadId,
      MESSAGE_ROLE.SYSTEM,
    );
    // this is temporary
    const tempSystemPrompt = "You are an AI Mentor for Mentingo";
    const tempSystemPromptTokenCount = this.tokenService.countTokens(model, tempSystemPrompt);

    // system prompt creation along with welcome message should go to create thread
    if (!systemPrompt)
      await this.aiRepository.insertMessage({
        content: tempSystemPrompt,
        role: MESSAGE_ROLE.SYSTEM,
        threadId: data.threadId,
        tokenCount: tempSystemPromptTokenCount,
      });

    // this is temporary, WIP, just to see how it works, it will get cleaner
    systemPrompt = await this.aiRepository.findFirstMessageByRoleAndThread(
      data.threadId,
      MESSAGE_ROLE.SYSTEM,
    );
    if (systemPrompt) savedMessages.history.unshift(systemPrompt);

    const summary = await this.aiRepository.findFirstMessageByRoleAndThread(
      data.threadId,
      MESSAGE_ROLE.SUMMARY,
    );
    if (summary) savedMessages.history.unshift(summary);

    savedMessages.history.push({ role: MESSAGE_ROLE.USER, content: data.content });

    const mentorResponse = await this.chatService.chat(savedMessages.history, model);
    const tokenCount = this.tokenService.countTokens(model, data.content);
    const mentorTokenCount = this.tokenService.countTokens(model, mentorResponse);

    const mentorMessage = {
      content: mentorResponse,
      role: MESSAGE_ROLE.MENTOR,
      tokenCount: mentorTokenCount,
      threadId: data.threadId,
    };

    await this.aiRepository.createMessage({
      ...data,
      tokenCount,
      role: MESSAGE_ROLE.USER,
    });

    await this.aiRepository.createMessage(mentorMessage);

    return { data: mentorMessage };
  }

  private async summarize(threadId: UUIDType) {
    const { history, language } = await this.aiRepository.getMessageHistory(threadId, false);

    const mappedHistory = history.map((msg: any) => `${msg.role}: ${msg.content}`).join("\n");

    const summaryPrompt = this.structureSummaryPrompt(mappedHistory, language);
    const summarized = await this.chatService.generatePrompt(summaryPrompt, OPENAI_MODELS.BASIC);
    const tokenCount = this.tokenService.countTokens(OPENAI_MODELS.BASIC, summarized);

    await this.aiRepository.archiveMessages(threadId);

    const exists = await this.aiRepository.findFirstMessageByRoleAndThread(
      threadId,
      MESSAGE_ROLE.SUMMARY,
    );
    if (exists) {
      await this.aiRepository.updateSummary(threadId, summarized, tokenCount);
    } else {
      await this.aiRepository.insertMessage({
        content: summarized,
        role: MESSAGE_ROLE.SUMMARY,
        threadId,
        tokenCount,
      });
    }

    return summarized;
  }

  private structureSummaryPrompt(summaryContent: string, language: SupportedLanguages) {
    return `${SUMMARY_PROMPT.trim()} ${language} \n${summaryContent.trim()}`;
  }
}
