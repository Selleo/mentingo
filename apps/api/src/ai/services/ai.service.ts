import { openai } from "@ai-sdk/openai";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { type Message, streamText } from "ai";
import { eq } from "drizzle-orm";

import { MAX_TOKENS } from "src/ai/ai.constants";
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
  type MessageRole,
  OPENAI_MODELS,
  type OpenAIModels,
  THREAD_STATUS,
} from "src/ai/utils/ai.type";
import { aiMentorThreads } from "src/storage/schema";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";

import type {
  CreateThreadBody,
  ResponseAiJudgeJudgementBody,
  StreamChatBody,
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
  ) {}

  async getThreadWithSetup(data: CreateThreadBody) {
    const threadData = await this.threadService.createThreadIfNoneExist(data);

    if (!threadData.newThread) {
      return { data: threadData.thread };
    }

    const systemPrompt = await this.promptService.setSystemPrompt({
      threadId: threadData.thread.id,
      userId: threadData.thread.userId,
    });

    await this.sendWelcomeMessage(threadData.thread.id, systemPrompt);

    return { data: threadData.thread };
  }

  async streamMessage(data: StreamChatBody, model: OpenAIModels, userId: UUIDType) {
    await this.isThreadActive(data.threadId, userId);
    await this.summaryService.summarizeThreadOnTokenThreshold(data.threadId);

    const prompt = await this.promptService.buildPrompt(data.threadId, data.content, data.id);

    const result = streamText({
      model: openai(model),
      messages: prompt.map((m) => ({
        content: m.content,
        role: this.mapRole(m.role),
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
    const judged = await this.judgeService.runJudge(data);
    const lesson = await this.aiRepository.findLessonByThreadId(data.threadId);

    await this.markAsCompletedIfJudge(
      lesson.id,
      data.userId,
      USER_ROLES.STUDENT,
      judged.data,
      true,
    );

    const tokenCount = this.tokenService.countTokens(OPENAI_MODELS.BASIC, judged.data.summary);

    await this.aiRepository.insertMessage({
      threadId: data.threadId,
      content: judged.data.summary,
      role: MESSAGE_ROLE.MENTOR,
      tokenCount,
    });

    return { data: { summary: judged.data.summary, passed: judged.data.passed } };
  }

  async isThreadActive(threadId: UUIDType, userId?: UUIDType) {
    const thread = await this.aiRepository.findThread([eq(aiMentorThreads.id, threadId)]);

    if (userId && thread.userId !== userId)
      throw new ForbiddenException("You don't have access to this thread");

    if (thread.status !== THREAD_STATUS.ACTIVE)
      throw new BadRequestException("Thread must be active");

    return thread;
  }

  async markAsCompletedIfJudge(
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

  async retakeLesson(lessonId: UUIDType, userId: UUIDType) {
    const [lesson] = await this.aiRepository.checkLessonAssignment(lessonId, userId);

    if (!lesson.isAssigned && !lesson.isFreemium)
      throw new UnauthorizedException("You are not assigned to this lesson");

    await this.aiRepository.setThreadsToArchived(lessonId, userId);
    await this.aiRepository.resetStudentProgressForLesson(lessonId, userId);
  }

  private mapRole(role: MessageRole) {
    return role === MESSAGE_ROLE.SUMMARY ? MESSAGE_ROLE.SYSTEM : role;
  }
}
