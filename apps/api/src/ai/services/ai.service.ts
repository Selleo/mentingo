import { observe, propagateAttributes, updateActiveObservation } from "@langfuse/tracing";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { trace } from "@opentelemetry/api";
import { AI_MENTOR_TYPE, PERMISSIONS, getUiMessageText, hasPermission } from "@repo/shared";
import { eq } from "drizzle-orm";
import _ from "lodash";

import { AI_RUNTIME_SOURCES } from "src/ai/ai-runtime.types";
import { MAX_TOKENS } from "src/ai/ai.constants";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { ChatService } from "src/ai/services/chat.service";
import { JudgeService } from "src/ai/services/judge.service";
import { MessageService } from "src/ai/services/message.service";
import { PromptService } from "src/ai/services/prompt.service";
import { SummaryService } from "src/ai/services/summary.service";
import { ThreadService } from "src/ai/services/thread.service";
import { TokenService } from "src/ai/services/token.service";
import { loadAiSdk } from "src/ai/utils/ai-esm";
import {
  AI_MENTOR_TRACE_FLOWS,
  buildAiMentorTraceAttributes,
} from "src/ai/utils/ai-mentor-trace-context";
import { AI_TELEMETRY_FUNCTION_IDS, buildAiTelemetry } from "src/ai/utils/ai-telemetry";
import { generateTranslationSchema } from "src/ai/utils/ai.schema";
import {
  MESSAGE_ROLE,
  type MessageRole,
  OPENAI_MODELS,
  type OpenAIModels,
  THREAD_STATUS,
} from "src/ai/utils/ai.type";
import {
  alignTranslationItems,
  getTranslationContext,
  TranslationStructureError,
  validateTranslationStructure,
} from "src/ai/utils/translation-output";
import { stripVoiceControlTags } from "src/ai/utils/voiceControlTags";
import { DatabasePg } from "src/common";
import { PermissionsService } from "src/permissions/permissions.service";
import { dbAls } from "src/storage/db/db-als.store";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { aiMentorThreads } from "src/storage/schema";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";

import type { PublicAiMessage } from "@japro/luma-sdk";
import type { PermissionKey, SupportedLanguages } from "@repo/shared";
import type { ModelMessage } from "ai";
import type {
  AiStreamMessageInput,
  AiMentorChatStreamResult,
  AiStreamTextResult,
  AiTranscriptionResult,
  AiUiMessageStream,
} from "src/ai/ai-chat.types";
import type {
  CreateThreadBody,
  GenerateTranslationBody,
  ResponseAiJudgeJudgementBody,
  StreamChatBody,
  ThreadOwnershipBody,
} from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  ContextualCourseTranslationType,
  CourseTranslationType,
} from "src/courses/types/course.types";

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly tokenService: TokenService,
    private readonly aiRepository: AiRepository,
    private readonly threadService: ThreadService,
    private readonly messageService: MessageService,
    private readonly promptService: PromptService,
    private readonly summaryService: SummaryService,
    private readonly judgeService: JudgeService,
    private readonly aiRuntimeService: AiRuntimeService,
    private readonly permissionsService: PermissionsService,
    private readonly studentLessonProgressService: StudentLessonProgressService,
    private readonly tenantRunner: TenantDbRunnerService,
    @Inject(DB)
    private readonly db: DatabasePg,
  ) {}

  async getThreadWithSetup(data: CreateThreadBody) {
    return observe(
      async () =>
        propagateAttributes(
          buildAiMentorTraceAttributes({
            sessionId: data.lessonId,
            userId: data.userId,
            tenantId: dbAls.getStore()?.tenantId,
            flow: AI_MENTOR_TRACE_FLOWS.COURSE_LESSON,
            operation: "thread-setup",
            channel: "text",
            lessonId: data.lessonId,
          }),
          async () => {
            try {
              const threadData = await this.threadService.createThreadIfNoneExist(data);

              if (!threadData.newThread) {
                return { data: threadData.thread };
              }

              return propagateAttributes(
                buildAiMentorTraceAttributes({
                  sessionId: threadData.thread.id,
                  userId: data.userId,
                  tenantId: dbAls.getStore()?.tenantId,
                  flow: AI_MENTOR_TRACE_FLOWS.COURSE_LESSON,
                  operation: "thread-setup",
                  channel: "text",
                  threadId: threadData.thread.id,
                  lessonId: data.lessonId,
                  aiMentorLessonId: threadData.thread.aiMentorLessonId ?? undefined,
                }),
                async () => {
                  const systemPrompt = await this.promptService.setSystemPrompt({
                    threadId: threadData.thread.id,
                    userId: threadData.thread.userId,
                  });

                  await this.sendWelcomeMessage(threadData.thread.id, systemPrompt);

                  return { data: threadData.thread };
                },
              );
            } catch (error) {
              updateActiveObservation({
                level: "ERROR",
                statusMessage: error.message,
              });
              throw error;
            }
          },
        ),
      { name: "Get Thread", asType: "span" },
    )();
  }

  async getPracticeThreadWithSetup(data: {
    practiceSessionId: UUIDType;
    userId: UUIDType;
    userLanguage: SupportedLanguages;
  }) {
    return propagateAttributes(
      buildAiMentorTraceAttributes({
        sessionId: data.practiceSessionId,
        userId: data.userId,
        tenantId: dbAls.getStore()?.tenantId,
        flow: AI_MENTOR_TRACE_FLOWS.STANDALONE_PRACTICE,
        operation: "thread-setup",
        channel: "text",
        practiceSessionId: data.practiceSessionId,
      }),
      async () => {
        const existingThread = await this.aiRepository.findThread([
          eq(aiMentorThreads.practiceSessionId, data.practiceSessionId),
          eq(aiMentorThreads.userId, data.userId),
        ]);

        if (existingThread) return existingThread;

        const thread = await this.aiRepository.createThread({
          practiceSessionId: data.practiceSessionId,
          userId: data.userId,
          userLanguage: data.userLanguage,
          status: THREAD_STATUS.ACTIVE,
        });

        const systemPrompt = await this.promptService.setSystemPrompt(
          {
            threadId: thread.id,
            userId: thread.userId,
          },
          AI_MENTOR_TYPE.ROLEPLAY,
        );
        await propagateAttributes(
          buildAiMentorTraceAttributes({
            sessionId: thread.id,
            userId: data.userId,
            tenantId: dbAls.getStore()?.tenantId,
            flow: AI_MENTOR_TRACE_FLOWS.STANDALONE_PRACTICE,
            operation: "thread-setup",
            channel: "text",
            threadId: thread.id,
            practiceSessionId: data.practiceSessionId,
          }),
          () => this.sendWelcomeMessage(thread.id, systemPrompt),
        );

        return thread;
      },
    );
  }

  async streamMessage(
    data: AiStreamMessageInput,
    model: OpenAIModels,
    currentUser: CurrentUserType,
    isVoiceMentor: boolean = false,
  ): Promise<AiMentorChatStreamResult> {
    return observe(
      async () => {
        const thread = await this.isThreadActive(data.threadId, currentUser.userId);
        const sessionId = data.voiceSessionId ?? thread.practiceSessionId ?? data.threadId;

        return propagateAttributes(
          buildAiMentorTraceAttributes({
            sessionId,
            userId: currentUser.userId,
            tenantId: currentUser.tenantId,
            flow: thread.practiceSessionId
              ? AI_MENTOR_TRACE_FLOWS.STANDALONE_PRACTICE
              : AI_MENTOR_TRACE_FLOWS.COURSE_LESSON,
            operation: "chat",
            channel: isVoiceMentor ? "voice" : "text",
            threadId: data.threadId,
            lessonId: data.lessonId,
            aiMentorLessonId: thread.aiMentorLessonId ?? undefined,
            practiceSessionId: thread.practiceSessionId ?? undefined,
            voiceSessionId: data.voiceSessionId,
            voiceTurnId: data.voiceTurnId,
          }),
          async () => {
            await this.summaryService.summarizeThreadOnTokenThreshold(data.threadId);

            const prompt = await this.promptService.buildPrompt(
              data.threadId,
              data.content,
              isVoiceMentor,
              data.id,
              data.voiceTurnWasInterrupted,
              data.voiceDeliveryContext,
            );

            const generationConfig = isVoiceMentor
              ? {
                  temperature: 0.2,
                  topK: 20,
                  topP: 0.5,
                }
              : {
                  temperature: 0.8,
                  topK: 50,
                  topP: 0.8,
                };

            const createCoreStream = async (persistOnFinish = true) => {
              return await this.streamCoreMentorChat({
                data,
                model,
                currentUser,
                isVoiceMentor,
                prompt,
                generationConfig,
                persistOnFinish,
              });
            };

            const stream = await this.aiRuntimeService.streamMentorChat(
              {
                messages: this.toPublicAiMessages(prompt),
                temperature: generationConfig.temperature,
                voiceSessionId: data.voiceSessionId,
              },
              createCoreStream,
              data.abortSignal,
            );

            if (stream.source === AI_RUNTIME_SOURCES.CORE) return stream;

            return {
              ...stream,
              textStream: this.persistLumaMentorChatStream({
                stream: stream.textStream,
                data,
                model,
                currentUser,
                isVoiceMentor,
              }),
            };
          },
        );
      },
      { name: "Conversation", asType: "generation", endOnExit: false },
    )();
  }

  async createChatMessageUiStream(
    data: StreamChatBody,
    model: OpenAIModels,
    currentUser: CurrentUserType,
  ): Promise<AiUiMessageStream> {
    const response = await this.streamChatMessage(data, model, currentUser);

    if (response.source === AI_RUNTIME_SOURCES.CORE && response.coreStream) {
      const { toUIMessageStream } = await loadAiSdk();

      return toUIMessageStream({
        stream: response.coreStream.stream,
        onError: (error) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`chat core UI stream failed threadId=${data.threadId}: ${message}`);
          return "common.errors.unexpected";
        },
      });
    }

    const { createUIMessageStream } = await loadAiSdk();
    return createUIMessageStream({
      execute: async ({ writer }) => {
        await this.pipeTextStreamToUiMessageWriter(response.textStream, writer);
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`chat UI stream failed threadId=${data.threadId}: ${message}`);
        return "common.errors.unexpected";
      },
    });
  }

  async streamChatMessage(
    data: StreamChatBody,
    model: OpenAIModels,
    currentUser: CurrentUserType,
  ): Promise<AiMentorChatStreamResult> {
    const content = getUiMessageText(data.message).trim();

    if (!content) {
      throw new BadRequestException("common.validation.messageRequired");
    }

    return this.streamMessage(
      {
        threadId: data.threadId,
        content,
        id: data.id,
      },
      model,
      currentUser,
    );
  }

  async sendWelcomeMessage(threadId: UUIDType, systemPrompt: string) {
    const welcomeMessagePrompt = await this.promptService.loadPrompt("welcomePrompt", {
      systemPrompt,
    });
    const welcomeMessages: PublicAiMessage[] = [
      { role: MESSAGE_ROLE.SYSTEM, content: systemPrompt },
      { role: MESSAGE_ROLE.USER, content: welcomeMessagePrompt },
    ];

    const content = await observe(
      async () => {
        updateActiveObservation({
          input: {
            systemPrompt,
            prompt: welcomeMessagePrompt,
          },
        });

        return this.aiRuntimeService.generateMentorChat(
          {
            messages: welcomeMessages,
          },
          () =>
            this.chatService.generatePrompt(
              welcomeMessagePrompt,
              OPENAI_MODELS.BASIC,
              systemPrompt,
              AI_TELEMETRY_FUNCTION_IDS.AI_MENTOR_WELCOME,
            ),
        );
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

  async runJudge(data: ThreadOwnershipBody, currentUser?: CurrentUserType) {
    const thread = await this.aiRepository.findThread([eq(aiMentorThreads.id, data.threadId)]);
    if (!thread) throw new BadRequestException("Thread not found");

    const viewer = await this.resolveJudgeViewer(currentUser, thread.userId);

    const judged = await observe(
      async () =>
        propagateAttributes(
          buildAiMentorTraceAttributes({
            sessionId: thread.practiceSessionId ?? data.threadId,
            userId: thread.userId,
            tenantId: dbAls.getStore()?.tenantId,
            flow: thread.practiceSessionId
              ? AI_MENTOR_TRACE_FLOWS.STANDALONE_PRACTICE
              : AI_MENTOR_TRACE_FLOWS.COURSE_LESSON,
            operation: "evaluation",
            channel: "text",
            threadId: data.threadId,
            aiMentorLessonId: thread.aiMentorLessonId ?? undefined,
            practiceSessionId: thread.practiceSessionId ?? undefined,
          }),
          () => this.judgeService.runJudge(data, viewer),
        ),
      { name: "Thread Evaluator", asType: "evaluator" },
    )();

    const { lessonId } = await this.aiRepository.findLessonIdByThreadId(data.threadId);
    const { permissions: learnerPermissions } = await this.permissionsService.getUserAccess(
      thread.userId,
    );

    if (lessonId) {
      await this.markAsCompletedIfJudge(
        lessonId,
        thread.userId,
        learnerPermissions,
        currentUser,
        judged.data,
        thread.userLanguage,
        true,
      );
    }

    const { status: _status, ...judgeData } = judged.data;

    return {
      data: {
        ...judgeData,
      },
    };
  }

  async isThreadActive(threadId: UUIDType, userId?: UUIDType) {
    const thread = await this.aiRepository.findThread([eq(aiMentorThreads.id, threadId)]);

    if (userId && thread.userId !== userId)
      throw new ForbiddenException("You don't have access to this thread");

    if (thread.status !== THREAD_STATUS.ACTIVE)
      throw new BadRequestException("common.error.threadMustBeActive");

    return thread;
  }

  private async resolveJudgeViewer(
    currentUser: CurrentUserType | undefined,
    fallbackUserId: UUIDType,
  ) {
    if (currentUser)
      return {
        userId: currentUser.userId,
        permissions: currentUser.permissions,
      };

    const { permissions } = await this.permissionsService.getUserAccess(fallbackUserId);

    return {
      userId: fallbackUserId,
      permissions,
    };
  }

  async markAsCompletedIfJudge(
    lessonId: UUIDType,
    studentId: UUIDType,
    userPermissions: PermissionKey[],
    actor: CurrentUserType | undefined,
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
      userPermissions,
      actor,
      aiMentorLessonData,
      language,
    });
  }

  async retakeLesson(lessonId: UUIDType, currentUser: CurrentUserType) {
    const { userId, permissions } = currentUser;

    const [lesson] = await this.aiRepository.checkLessonAssignment(lessonId, userId);

    if (
      !lesson.isAssigned &&
      !lesson.isFreemium &&
      !hasPermission(permissions, PERMISSIONS.COURSE_UPDATE_OWN) &&
      !hasPermission(permissions, PERMISSIONS.COURSE_UPDATE)
    )
      throw new UnauthorizedException("You are not assigned to this lesson");

    if (hasPermission(permissions, PERMISSIONS.COURSE_UPDATE_OWN) && !lesson.isAssigned) {
      const courseAuthorId = await this.aiRepository.getCourseAuthorByLesson(lessonId);

      if (courseAuthorId !== userId) {
        throw new UnauthorizedException(
          "studentCourseView.lesson.aiMentorLesson.retakeAccessDenied",
        );
      }
    }

    await this.db.transaction(async (trx) => {
      await this.aiRepository.setThreadsToArchived(lessonId, userId, trx);
      await this.aiRepository.resetStudentProgressForLesson(lessonId, userId, trx);
    });
  }

  async transcribe(clientId: string, audio: Buffer): Promise<AiTranscriptionResult | undefined> {
    return observe(
      async () =>
        propagateAttributes({ sessionId: `transcription-${clientId}` }, async () => {
          const transcription = await this.aiRuntimeService.transcribeDictation(
            {
              file: new File([audio], `${clientId}.webm`),
            },
            async () => {
              const openai = await this.promptService.getOpenAI();
              const whisper = openai.transcriptionModel?.(OPENAI_MODELS.TRANSCRIBE);
              if (!whisper) return;
              const { experimental_transcribe } = await loadAiSdk();

              return await experimental_transcribe({
                model: whisper,
                audio,
              });
            },
          );

          updateActiveObservation(
            {
              input: { audioLength: audio.length },
              output: { ...transcription },
            },
            { asType: "generation" },
          );

          return transcription;
        }),
      { name: "transcription-generator", asType: "generation" },
    )();
  }

  async generateMissingTranslations(
    data: ContextualCourseTranslationType[],
    language: SupportedLanguages,
    courseId: string,
    chunkSize: number = 4,
  ) {
    return observe(
      async () =>
        propagateAttributes(
          { sessionId: `generate-missing-translations-${courseId}` },
          async () => {
            const prompt = await this.promptService.loadPrompt("translationPrompt", { language });

            const translateChunk = async (
              chunk: Array<{
                data: CourseTranslationType;
                metadata: string;
                context: Record<string, string | undefined>;
                itemId: string;
              }>,
            ) => {
              const preparedChunk = chunk.map((item) => ({
                ...item,
                context: getTranslationContext(item.metadata, item.data.base, item.context),
              }));
              const formatted = preparedChunk
                .map(({ data: c, metadata, context, itemId }, i) => {
                  const ctxLines = [
                    context.courseTitle && `Course: ${context.courseTitle}`,
                    context.chapterTitle && `Chapter: ${context.chapterTitle}`,
                    context.lessonTitle && `Lesson: ${context.lessonTitle}`,
                    context.lessonDescription && `Lesson description: ${context.lessonDescription}`,
                    context.questionTitle && `Question: ${context.questionTitle}`,
                    context.questionDescription &&
                      `Question description: ${context.questionDescription}`,
                    context.questionOptions && `Options:\n${context.questionOptions}`,
                    context.optionText && `Option: ${context.optionText}`,
                    context.aiJudgeTaskGoal && `AI Judge task goal: ${context.aiJudgeTaskGoal}`,
                    context.aiJudgeCriterionTitle &&
                      `AI Judge criterion: ${context.aiJudgeCriterionTitle}`,
                    context.aiJudgeExpectedBehavior &&
                      `Expected behavior: ${context.aiJudgeExpectedBehavior}`,
                    context.aiJudgeScore && `Score guidance: ${context.aiJudgeScore}`,
                  ]
                    .filter(Boolean)
                    .join("\n");

                  return [
                    `ITEM ${i + 1}`,
                    `ITEM ID: ${itemId}`,
                    `METADATA: ${metadata}`,
                    ctxLines ? `CONTEXT:\n${ctxLines}` : undefined,
                    `TEXT TO TRANSLATE:\n${c.base}`,
                  ]
                    .filter(Boolean)
                    .join("\n");
                })
                .join("\n\n");

              const { jsonSchema } = await loadAiSdk();
              const schema = jsonSchema(generateTranslationSchema);

              const userContent = `Return exactly ${chunk.length} strings. Each output string MUST start with the matching ITEM ID, followed by one newline and the translated text. Preserve each ITEM ID exactly. Each ITEM provides context; only translate the TEXT TO TRANSLATE.\n\n${formatted}`;

              const run = async () => {
                return await this.aiRuntimeService.generateTranslations(
                  {
                    messages: [
                      { role: MESSAGE_ROLE.SYSTEM, content: prompt },
                      { role: MESSAGE_ROLE.USER, content: userContent },
                    ],
                    temperature: 0,
                  },
                  async () => {
                    const openai = await this.promptService.getOpenAI();
                    const { generateObject } = await loadAiSdk();
                    const { object } = await generateObject({
                      model: openai(OPENAI_MODELS.TRANSLATION),
                      schema,
                      system: prompt,
                      temperature: 0,
                      topP: 0.9,
                      topK: 10,
                      telemetry: buildAiTelemetry(AI_TELEMETRY_FUNCTION_IDS.COURSE_TRANSLATION),
                      messages: [
                        {
                          role: "user",
                          content: userContent,
                        },
                      ],
                    });

                    return object as GenerateTranslationBody;
                  },
                );
              };

              const { translations } = await run();

              try {
                const alignedTranslations = alignTranslationItems(
                  translations,
                  chunk.map(({ itemId }) => itemId),
                );

                alignedTranslations.forEach((translatedText, index) => {
                  validateTranslationStructure(chunk[index].data.base, translatedText);
                });

                return alignedTranslations;
              } catch (error) {
                const translationErrorKey =
                  error instanceof TranslationStructureError
                    ? "adminCourseView.toast.invalidTranslationStructure"
                    : "adminCourseView.toast.mismatchContentLength";

                throw new BadRequestException(translationErrorKey);
              }
            };

            const chunked = _.chunk(
              data.map((item, index) => ({ ...item, itemId: `translation-item-${index + 1}` })),
              chunkSize,
            );

            return Promise.all(chunked.map(translateChunk));
          },
        ),
      { name: "translation-generator", asType: "generation" },
    )();
  }

  private async streamCoreMentorChat({
    data,
    model,
    currentUser,
    isVoiceMentor,
    prompt,
    generationConfig,
    persistOnFinish,
  }: {
    data: AiStreamMessageInput;
    model: OpenAIModels;
    currentUser: CurrentUserType;
    isVoiceMentor: boolean;
    prompt: Array<{ role: MessageRole; content: string }>;
    generationConfig: {
      temperature: number;
      topK: number;
      topP: number;
    };
    persistOnFinish: boolean;
  }): Promise<AiStreamTextResult> {
    const provider = await this.promptService.getOpenAI();
    const { streamText } = await loadAiSdk();
    const { instructions, messages } = this.toCorePrompt(prompt);

    return streamText({
      model: provider(model),
      instructions,
      messages,
      maxOutputTokens: MAX_TOKENS,
      abortSignal: data.abortSignal,
      ...generationConfig,
      telemetry: buildAiTelemetry(AI_TELEMETRY_FUNCTION_IDS.AI_MENTOR_CHAT),
      onFinish: async (event) => {
        const mentorContent = isVoiceMentor ? stripVoiceControlTags(event.text) : event.text;

        if (persistOnFinish && !data.abortSignal?.aborted) {
          await this.persistMentorChatMessages({
            data,
            model,
            currentUser,
            mentorContent,
          });
        }

        trace.getActiveSpan()?.end();
      },
      onError: ({ error }) => {
        this.updateActiveObservationIfSpan({
          level: "ERROR",
          statusMessage: (error as Error).message ?? "An error occurred during streaming",
        });

        trace.getActiveSpan()?.end();
      },
    });
  }

  private async *persistLumaMentorChatStream({
    stream,
    data,
    model,
    currentUser,
    isVoiceMentor,
  }: {
    stream: AsyncIterable<string>;
    data: AiStreamMessageInput;
    model: OpenAIModels;
    currentUser: CurrentUserType;
    isVoiceMentor: boolean;
  }): AsyncIterable<string> {
    let mentorContent = "";

    try {
      for await (const delta of stream) {
        mentorContent += delta;
        yield delta;
      }

      const persistedContent = isVoiceMentor ? stripVoiceControlTags(mentorContent) : mentorContent;
      await this.persistMentorChatMessages({
        data,
        model,
        currentUser,
        mentorContent: persistedContent,
      });

      trace.getActiveSpan()?.end();
    } catch (error) {
      this.updateActiveObservationIfSpan({
        level: "ERROR",
        statusMessage: (error as Error).message ?? "An error occurred during streaming",
      });
      trace.getActiveSpan()?.end();
      throw error;
    }
  }

  private async persistMentorChatMessages({
    data,
    model,
    currentUser,
    mentorContent,
  }: {
    data: AiStreamMessageInput;
    model: OpenAIModels;
    currentUser: CurrentUserType;
    mentorContent: string;
  }) {
    const mentorTokenCount = this.tokenService.countTokens(model, mentorContent);
    const userTokenCount = this.tokenService.countTokens(model, data.content);

    if (!currentUser.tenantId) throw new Error("Missing tenant context in onFinish");

    await this.tenantRunner.runWithTenant(currentUser.tenantId, async () => {
      await this.messageService.createMessages(
        { ...data, role: MESSAGE_ROLE.USER, tokenCount: userTokenCount },
        {
          threadId: data.threadId,
          content: mentorContent,
          role: MESSAGE_ROLE.MENTOR,
          tokenCount: mentorTokenCount,
        },
      );
    });

    this.updateActiveObservationIfSpan({
      input: { message: data.content },
      output: { message: mentorContent },
    });
  }

  private updateActiveObservationIfSpan(data: unknown, options?: unknown) {
    if (!trace.getActiveSpan()) return;
    if (options === undefined) {
      (updateActiveObservation as (data: unknown) => void)(data);
      return;
    }
    (updateActiveObservation as (data: unknown, options: unknown) => void)(data, options);
  }

  private toPublicAiMessages(
    prompt: Array<{ role: MessageRole; content: string }>,
  ): PublicAiMessage[] {
    return prompt.map((message) => ({
      role: this.mapPublicAiRole(message.role),
      content: message.content,
    }));
  }

  private mapPublicAiRole(role: MessageRole): PublicAiMessage["role"] {
    const mappedRole = this.mapRole(role);

    if (mappedRole === MESSAGE_ROLE.USER || mappedRole === MESSAGE_ROLE.MENTOR) {
      return mappedRole;
    }

    return MESSAGE_ROLE.SYSTEM;
  }

  private toCorePrompt(prompt: Array<{ role: MessageRole; content: string }>): {
    instructions?: string;
    messages: ModelMessage[];
  } {
    const instructionParts: string[] = [];
    const messages: ModelMessage[] = [];

    for (const message of prompt) {
      const role = this.mapRole(message.role);

      if (role === MESSAGE_ROLE.SYSTEM || role === MESSAGE_ROLE.TOOL) {
        instructionParts.push(message.content);
        continue;
      }

      if (role === MESSAGE_ROLE.USER) {
        messages.push({
          content: message.content,
          role: MESSAGE_ROLE.USER,
        });
        continue;
      }

      messages.push({
        content: message.content,
        role: MESSAGE_ROLE.MENTOR,
      });
    }

    return {
      instructions: instructionParts.length ? instructionParts.join("\n\n") : undefined,
      messages,
    };
  }

  private async pipeTextStreamToUiMessageWriter(
    stream: AsyncIterable<string>,
    writer: { write: (chunk: { type: string; id?: string; delta?: string }) => void },
  ) {
    const textPartId = "mentor-text";
    let hasStartedText = false;

    for await (const delta of stream) {
      if (!delta) continue;

      if (!hasStartedText) {
        writer.write({
          type: "text-start",
          id: textPartId,
        });
        hasStartedText = true;
      }

      writer.write({
        type: "text-delta",
        id: textPartId,
        delta,
      });
    }

    if (hasStartedText) {
      writer.write({
        type: "text-end",
        id: textPartId,
      });
    }
  }

  private mapRole(role: MessageRole) {
    return role === MESSAGE_ROLE.SUMMARY ? MESSAGE_ROLE.SYSTEM : role;
  }
}
