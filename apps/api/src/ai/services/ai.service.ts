import { observe, updateActiveObservation, updateActiveTrace } from "@langfuse/tracing";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { trace } from "@opentelemetry/api";
import { generateObject, jsonSchema, type Message, streamText } from "ai";
import { eq } from "drizzle-orm";
import _ from "lodash";
import { Type } from "@sinclair/typebox";

import { MAX_TOKENS } from "src/ai/ai.constants";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { ChatService } from "src/ai/services/chat.service";
import { JudgeService } from "src/ai/services/judge.service";
import { MessageService } from "src/ai/services/message.service";
import { PromptService } from "src/ai/services/prompt.service";
import { SummaryService } from "src/ai/services/summary.service";
import { ThreadService } from "src/ai/services/thread.service";
import { TokenService } from "src/ai/services/token.service";
import {
  MESSAGE_ROLE,
  type MessageRole,
  OPENAI_MODELS,
  type OpenAIModels,
  THREAD_STATUS,
} from "src/ai/utils/ai.type";
import { DatabasePg } from "src/common";
import { QueueService } from "src/ingestion/services/queue.service";
import { aiMentorThreads } from "src/storage/schema";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";

import type { SupportedLanguages } from "@repo/shared";
import {
  CreateThreadBody,
  GenerateTranslationBody,
  generateTranslationSchema,
  ResponseAiJudgeJudgementBody,
  StreamChatBody,
  ThreadOwnershipBody,
} from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";
import type { CourseTranslationType } from "src/courses/types/course.types";

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
    @Inject("DB")
    private readonly db: DatabasePg,
  ) {}

  async getThreadWithSetup(data: CreateThreadBody) {
    return observe(
      async () => {
        try {
          const threadData = await this.threadService.createThreadIfNoneExist(data);

          if (!threadData.newThread) {
            return { data: threadData.thread };
          }

          updateActiveTrace({ userId: threadData.thread.userId, sessionId: threadData.thread.id });

          const systemPrompt = await this.promptService.setSystemPrompt({
            threadId: threadData.thread.id,
            userId: threadData.thread.userId,
          });

          await this.sendWelcomeMessage(threadData.thread.id, systemPrompt);

          return { data: threadData.thread };
        } catch (error) {
          updateActiveObservation({
            level: "ERROR",
            statusMessage: error.message,
          });
          throw error;
        }
      },
      { name: "Get Thread", asType: "span" },
    )();
  }

  async streamMessage(data: StreamChatBody, model: OpenAIModels, userId: UUIDType) {
    return observe(
      async () => {
        updateActiveTrace({
          sessionId: data.threadId,
          userId,
        });

        await this.isThreadActive(data.threadId, userId);
        await this.summaryService.summarizeThreadOnTokenThreshold(data.threadId);

        const prompt = await this.promptService.buildPrompt(data.threadId, data.content, data.id);
        const provider = await this.promptService.getOpenAI();

        return streamText({
          model: provider(model),
          messages: prompt.map((m) => ({
            content: m.content,
            role: this.mapRole(m.role),
          })) as Omit<Message, "id">[],
          maxTokens: MAX_TOKENS,
          temperature: 0.8,
          topK: 50,
          topP: 0.8,
          experimental_telemetry: { isEnabled: true },
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

            updateActiveObservation({
              input: { message: data.content },
              output: { message: event.text },
            });

            trace.getActiveSpan()?.end();
          },
          onError: ({ error }) => {
            updateActiveObservation({
              level: "ERROR",
              statusMessage: (error as Error).message ?? "An error occurred during streaming",
            });

            trace.getActiveSpan()?.end();
          },
        });
      },
      { name: "Conversation", asType: "generation", endOnExit: false },
    )();
  }

  async sendWelcomeMessage(threadId: UUIDType, systemPrompt: string) {
    const welcomeMessagePrompt = await this.promptService.loadPrompt("welcomePrompt", {
      systemPrompt,
    });

    const content = await observe(
      async () => {
        return this.chatService.generatePrompt(welcomeMessagePrompt, OPENAI_MODELS.BASIC);
      },
      { name: "Start Conversation", asType: "generation" },
    )();

    const tokenCount = this.tokenService.countTokens(OPENAI_MODELS.BASIC, content);

    await this.aiRepository.insertMessage({
      threadId,
      content,
      tokenCount,
      role: MESSAGE_ROLE.MENTOR,
    });
  }

  async runJudge(data: ThreadOwnershipBody, userRole: UserRole = USER_ROLES.STUDENT) {
    const judged = await observe(
      async () => {
        updateActiveTrace({ sessionId: data.threadId, userId: data.userId });
        return this.judgeService.runJudge(data);
      },
      { name: "Thread Evaluator", asType: "evaluator" },
    )();

    const { lessonId } = await this.aiRepository.findLessonIdByThreadId(data.threadId);

    const thread = await this.aiRepository.findThread([eq(aiMentorThreads.id, data.threadId)]);

    await this.markAsCompletedIfJudge(
      lessonId,
      data.userId,
      userRole,
      judged.data,
      thread.userLanguage,
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
    language: SupportedLanguages,
    isJudge?: boolean,
  ) {
    if (!isJudge) return;

    const aiMentorLessonData: ResponseAiJudgeJudgementBody =
      typeof message === "string" ? JSON.parse(message) : message;

    await this.studentLessonProgressService.markLessonAsCompleted({
      id: lessonId,
      studentId,
      userRole,
      aiMentorLessonData,
      language,
    });
  }

  async retakeLesson(lessonId: UUIDType, userId: UUIDType, userRole: UserRole) {
    const [lesson] = await this.aiRepository.checkLessonAssignment(lessonId, userId);

    if (userRole === USER_ROLES.STUDENT && !lesson.isAssigned && !lesson.isFreemium)
      throw new UnauthorizedException("You are not assigned to this lesson");

    await this.db.transaction(async (trx) => {
      await this.aiRepository.setThreadsToArchived(lessonId, userId, trx);
      await this.aiRepository.resetStudentProgressForLesson(lessonId, userId, trx);
    });
  }

  async generateMissingTranslations(
    data: CourseTranslationType[],
    language: SupportedLanguages,
    chunkSize: number = 6,
  ) {
    const openai = await this.promptService.getOpenAI();
    const prompt = await this.promptService.loadPrompt("translationPrompt", { language });

    const translateChunk = async (chunk: CourseTranslationType[]) => {
      const formatted = chunk.map((c, i) => `${i + 1}. ${c.base}`).join("\n");
      const schema = jsonSchema(generateTranslationSchema);

      const baseConfig = {
        model: openai(OPENAI_MODELS.BASIC),
        schema,
        system: prompt,
        temperature: 0,
        topP: 0.9,
        topK: 40,
      };

      const run = async () => {
        const { object } = await generateObject({
          ...baseConfig,
          output: "object",
          messages: [
            {
              role: "user",
              content: `Return exactly ${chunk.length} translated strings as an array, same order:\n${formatted}`,
            },
          ],
        });
        return object as GenerateTranslationBody;
      };

      const { translations } = await run();

      return translations;
    };

    const chunked = _.chunk(data, chunkSize);
    return Promise.all(chunked.map(translateChunk));
  }

  private mapRole(role: MessageRole) {
    return role === MESSAGE_ROLE.SUMMARY ? MESSAGE_ROLE.SYSTEM : role;
  }
}
