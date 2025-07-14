import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";

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
import { DatabasePg } from "src/common";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";

import type {
  CreateThreadBody,
  CreateThreadMessageBody,
  ResponseAiJudgeJudgementBody,
  ThreadOwnershipBody,
} from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";

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
    private readonly studentLessonProgressService: StudentLessonProgressService,
    @Inject("DB") private readonly db: DatabasePg,
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

    const mentorResponseContent = await this.messageService.parseMentorResponse(mentorResponse);

    const mentorTokenCount = this.tokenService.countTokens(model, mentorResponseContent);
    const tokenCount = this.tokenService.countTokens(model, data.content);

    const mentorMessage = {
      content: mentorResponseContent,
      role: MESSAGE_ROLE.MENTOR,
      tokenCount: mentorTokenCount,
      threadId: data.threadId,
      isJudge: mentorResponse.isJudge,
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
    return await this.db.transaction(async () => {
      const judged = await this.judgeService.runJudge(data);
      const lesson = await this.aiRepository.findLessonByThreadId(data.threadId);

      await this.markAsCompletedIfJudge(
        lesson.id,
        data.userId,
        USER_ROLES.STUDENT,
        judged.data,
        true,
      );
      return judged;
    });
  }

  private async isThreadActive(threadId: UUIDType) {
    const thread = await this.aiRepository.findThread(threadId);
    if (thread.status !== THREAD_STATUS.ACTIVE)
      throw new BadRequestException("Thread must be active");

    return thread;
  }

  private async markAsCompletedIfJudge(
    lessonId: UUIDType,
    studentId: UUIDType,
    userRole: UserRole,
    message: string | ResponseAiJudgeJudgementBody,
    isJudge?: boolean,
  ) {
    if (!isJudge) return;

    const aiMentorLessonData: ResponseAiJudgeJudgementBody =
      typeof message === "string" ? JSON.parse(message) : message;
    await this.studentLessonProgressService.markLessonAsCompleted(
      lessonId,
      studentId,
      userRole,
      undefined,
      undefined,
      undefined,
      aiMentorLessonData,
    );
  }
}
