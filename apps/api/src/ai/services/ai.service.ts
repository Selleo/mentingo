import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { ChatService } from "src/ai/services/chat.service";
import { JudgeService } from "src/ai/services/judge.service";
import { MessageService } from "src/ai/services/message.service";
import { PromptService } from "src/ai/services/prompt.service";
import { SummaryService } from "src/ai/services/summary.service";
import { ThreadService } from "src/ai/services/thread.service";
import { TokenService } from "src/ai/services/token.service";
import { WELCOME_MESSAGE_PROMPT } from "src/ai/utils/ai.config";
import {
  MESSAGE_ROLE,
  OPENAI_MODELS,
  type OpenAIModels,
  THREAD_STATUS,
} from "src/ai/utils/ai.type";

import type {
  CreateThreadBody,
  CreateThreadMessageBody,
  ThreadOwnershipBody,
} from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";
import type { UserRole } from "src/user/schemas/userRoles";

@Injectable()
export class AiService {
  constructor(
    private readonly chatService: ChatService,
    private readonly tokenService: TokenService,
    private readonly aiRepository: AiRepository,
    private readonly threadService: ThreadService,
    private readonly messageService: MessageService,
    private readonly promptService: PromptService,
    private readonly summaryService: SummaryService,
    private readonly judgeService: JudgeService,
  ) {}

  async createThreadWithSetup(data: CreateThreadBody, role: UserRole) {
    const thread = await this.threadService.createThread(data, role);

    const systemPrompt = await this.promptService.setSystemPrompt({
      threadId: thread.id,
      userId: thread.userId,
    });

    await this.sendWelcomeMessage(thread.id, systemPrompt);

    return { data: thread };
  }
  async generateMessage(data: CreateThreadMessageBody, model: OpenAIModels, userId: UUIDType) {
    const thread = await this.isThreadActive(data.threadId);
    if (thread.userId !== userId)
      throw new ForbiddenException("You don't have access to this thread");

    await this.summaryService.summarizeIfNeeded(data.threadId);

    const prompt = await this.promptService.buildPrompt(data.threadId, data.content);
    const mentorResponse = await this.chatService.chatWithMentor(prompt, model, this);

    const mentorTokenCount = this.tokenService.countTokens(model, mentorResponse);
    const tokenCount = this.tokenService.countTokens(model, data.content);

    const mentorMessage = {
      content: mentorResponse,
      role: MESSAGE_ROLE.MENTOR,
      tokenCount: mentorTokenCount,
      threadId: data.threadId,
    };

    await this.messageService.createMessages(
      {
        ...data,
        tokenCount,
        role: MESSAGE_ROLE.USER,
      },
      mentorMessage,
    );

    return { data: mentorMessage };
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

  async runJudge(data: ThreadOwnershipBody) {
    return this.judgeService.runJudge(data);
  }

  private async isThreadActive(threadId: UUIDType) {
    const thread = await this.aiRepository.findThread(threadId);
    if (thread.status !== THREAD_STATUS.ACTIVE)
      throw new BadRequestException("Thread must be active");

    return thread;
  }
}
