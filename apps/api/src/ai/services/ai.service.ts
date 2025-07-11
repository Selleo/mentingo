import { BadRequestException, Injectable } from "@nestjs/common";

import {
  SUMMARY_PROMPT,
  SYSTEM_PROMPT_FOR_JUDGE,
  SYSTEM_PROMPT_FOR_MENTOR,
  THRESHOLD,
  WELCOME_MESSAGE_PROMPT,
} from "src/ai/ai.config";
import {
  MESSAGE_ROLE,
  type MessageRole,
  OPENAI_MODELS,
  type OpenAIModels,
  THREAD_STATUS,
} from "src/ai/ai.type";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { ChatService } from "src/ai/services/chat.service";
import { ThreadService } from "src/ai/services/thread.service";
import { TokenService } from "src/ai/services/token.service";

import type {
  CreateThreadMessageBody,
  ThreadMessageBody,
  ThreadOwnershipBody,
} from "src/ai/ai.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class AiService {
  constructor(
    private readonly chatService: ChatService,
    private readonly tokenService: TokenService,
    private readonly aiRepository: AiRepository,
    private readonly threadService: ThreadService,
  ) {}

  async generateMessage(data: CreateThreadMessageBody, model: OpenAIModels) {
    await this.isThreadActive(data.threadId);
    await this.summarizeIfNeeded(data.threadId);

    const prompt = await this.getPrompt(data.threadId, data.content);
    const mentorResponse = await this.chatService.chatWithMentor(prompt, model);

    const mentorTokenCount = this.tokenService.countTokens(model, mentorResponse);
    const tokenCount = this.tokenService.countTokens(model, data.content);

    const mentorMessage = {
      content: mentorResponse,
      role: MESSAGE_ROLE.MENTOR,
      tokenCount: mentorTokenCount,
      threadId: data.threadId,
    };

    await this.createMessages(
      {
        ...data,
        tokenCount,
        role: MESSAGE_ROLE.USER,
      },
      mentorMessage,
    );

    return { data: mentorMessage };
  }

  private async createMessages(
    studentMessage: ThreadMessageBody,
    mentorMessage: ThreadMessageBody,
  ) {
    await this.aiRepository.createMessage(studentMessage);
    await this.aiRepository.createMessage(mentorMessage);
  }

  private async getPrompt(threadId: UUIDType, content: string) {
    const { history } = await this.findMessageHistory(threadId, false);

    const systemPrompt = await this.aiRepository.findFirstMessageByRoleAndThread(
      threadId,
      MESSAGE_ROLE.SYSTEM,
    );

    const summary = await this.aiRepository.findFirstMessageByRoleAndThread(
      threadId,
      MESSAGE_ROLE.SUMMARY,
    );

    if (summary) history.unshift({ role: summary.role, content: summary.content });
    if (systemPrompt) history.unshift({ role: systemPrompt.role, content: systemPrompt.content });

    history.push({ role: MESSAGE_ROLE.USER, content });

    return history;
  }

  private async summarize(threadId: UUIDType) {
    const { history, language } = await this.findMessageHistory(threadId, false);

    const mappedHistory = history.map((msg: any) => `${msg.role}: ${msg.content}`).join("\n");

    const summaryPrompt = SUMMARY_PROMPT(mappedHistory, language.language);
    const summarized = await this.chatService.generatePrompt(summaryPrompt, OPENAI_MODELS.BASIC);
    const tokenCount = this.tokenService.countTokens(OPENAI_MODELS.BASIC, summarized);

    await this.aiRepository.archiveMessages(threadId);
    await this.upsertSummary(threadId, summarized, tokenCount);

    return summarized;
  }

  async findMessageHistory(threadId: UUIDType, archived?: boolean, role?: MessageRole) {
    const history = await this.aiRepository.findMessageHistory(threadId, archived, role);
    const language = await this.aiRepository.findThreadLanguage(threadId);

    return { history, language };
  }

  async setSystemPrompt(threadId: UUIDType) {
    const lang = await this.aiRepository.findThreadLanguage(threadId);
    const mentorLesson = await this.aiRepository.findMentorLessonByThreadId(threadId);
    const groups = await this.aiRepository.findGroupsByThreadId(threadId);

    delete mentorLesson.conditions;

    const systemPrompt = SYSTEM_PROMPT_FOR_MENTOR(mentorLesson, groups, lang.language);
    const tokenCount = this.tokenService.countTokens(OPENAI_MODELS.BASIC, systemPrompt);
    await this.aiRepository.insertMessage({
      threadId,
      tokenCount,
      role: MESSAGE_ROLE.SYSTEM,
      content: systemPrompt,
    });

    return systemPrompt;
  }

  async runJudge(data: ThreadOwnershipBody) {
    const thread = await this.threadService.findThread(data.threadId, data.userId);
    if (thread.data.status !== THREAD_STATUS.ACTIVE)
      throw new BadRequestException("Thread must be active");

    const mentorLesson = await this.aiRepository.findMentorLessonByThreadId(data.threadId);

    const messages = await this.findMessageHistory(data.threadId, undefined, MESSAGE_ROLE.USER);

    const content = messages.history.map(({ content }) => content).join("\n");
    const system = SYSTEM_PROMPT_FOR_JUDGE(mentorLesson, messages.language.language);

    return await this.chatService.judge(system, content);
  }

  async sendWelcomeMessage(threadId: UUIDType, systemPrompt: string) {
    const welcomeMessagePrompt = WELCOME_MESSAGE_PROMPT(systemPrompt);
    const content = await this.chatService.generatePrompt(
      welcomeMessagePrompt,
      OPENAI_MODELS.BASIC,
    );
    const tokenCount = this.tokenService.countTokens(OPENAI_MODELS.BASIC, content);
    await this.aiRepository.insertMessage({
      threadId,
      content,
      tokenCount,
      role: MESSAGE_ROLE.MENTOR,
    });
  }

  private async upsertSummary(threadId: UUIDType, content: string, tokenCount: number) {
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

  private async isThreadActive(threadId: UUIDType) {
    const thread = await this.aiRepository.findThread(threadId);
    if (thread.status !== THREAD_STATUS.ACTIVE)
      throw new BadRequestException("Thread must be active");

    return thread;
  }

  private async summarizeIfNeeded(threadId: UUIDType) {
    const tokens = await this.aiRepository.getTokenSumForThread(threadId, false);
    if (Number(tokens.total) > THRESHOLD) {
      await this.summarize(threadId);
    }
  }
}
