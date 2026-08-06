import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AI_MENTOR_TYPE } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { AiPracticeQueueService } from "src/ai/ai-practice.queue.service";
import {
  AI_MENTOR_PRACTICE_STATUSES,
  type AiMentorPracticeJobData,
} from "src/ai/ai-practice.types";
import {
  AI_JUDGE_GENERATION_MODE,
  AI_JUDGE_GENERATION_STATUS,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";
import { AiJudgeConfigurationGenerationWorkflowService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generation-workflow.service";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiPracticeJudgeConfigurationService } from "src/ai/services/ai-practice-judge-configuration.service";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { AiService } from "src/ai/services/ai.service";
import { PromptService } from "src/ai/services/prompt.service";
import { loadAiSdk } from "src/ai/utils/ai-esm";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";
import { EnvService } from "src/env/services/env.service";

import type {
  AiMentorPracticeSessionResponse,
  CreateAiMentorPracticeBody,
} from "src/ai/ai-practice.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

const practiceGenerationSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 160 }),
  instructions: Type.String({ minLength: 1, maxLength: 6000 }),
});

@Injectable()
export class AiPracticeService {
  constructor(
    private readonly aiRepository: AiRepository,
    private readonly aiPracticeQueueService: AiPracticeQueueService,
    private readonly aiPracticeJudgeConfigurationService: AiPracticeJudgeConfigurationService,
    private readonly aiJudgeConfigurationGenerationWorkflowService: AiJudgeConfigurationGenerationWorkflowService,
    private readonly aiRuntimeService: AiRuntimeService,
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
    private readonly envService: EnvService,
  ) {}

  async getToday(currentUser: CurrentUserType): Promise<AiMentorPracticeSessionResponse | null> {
    const practiceDate = this.getPracticeDate();
    const session = await this.aiRepository.findPracticeSessionByDate(
      currentUser.userId,
      practiceDate,
    );

    return session ? this.mapSession(session) : null;
  }

  async create(
    body: CreateAiMentorPracticeBody,
    currentUser: CurrentUserType,
  ): Promise<AiMentorPracticeSessionResponse> {
    if (!(await this.envService.getAIConfigured()).enabled)
      throw new ForbiddenException("dashboardHome.widgets.ai_mentor_practice.aiNotConfigured");

    const answers = {
      challenge: body.challenge.trim(),
      counterpart: body.counterpart.trim(),
      desiredOutcome: body.desiredOutcome.trim(),
    };
    if (Object.values(answers).some((answer) => !answer))
      throw new BadRequestException("common.validation.required");

    const practiceDate = this.getPracticeDate();

    const session = await this.aiRepository.createPracticeSession({
      userId: currentUser.userId,
      practiceDate,
      timezone: "UTC",
      language: body.language,
      ...answers,
    });

    if (!session) {
      const existing = await this.aiRepository.findPracticeSessionByDate(
        currentUser.userId,
        practiceDate,
      );
      if (!existing) throw new ConflictException("common.toast.somethingWentWrong");
      return this.mapSession(existing);
    }

    await this.enqueueGeneration(session.id, currentUser.tenantId);

    return this.mapSession({ ...session, threadId: null });
  }

  async getById(
    sessionId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<AiMentorPracticeSessionResponse> {
    const session = await this.aiRepository.findPracticeSessionById(sessionId);
    if (!session) throw new NotFoundException("common.toast.notFound");
    if (session.userId !== currentUser.userId)
      throw new ForbiddenException("common.toast.noAccess");

    return this.mapSession(session);
  }

  async retry(
    sessionId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<AiMentorPracticeSessionResponse> {
    const session = await this.aiRepository.findPracticeSessionById(sessionId);
    if (!session) throw new NotFoundException("common.toast.notFound");
    if (session.userId !== currentUser.userId)
      throw new ForbiddenException("common.toast.noAccess");
    if (session.status !== AI_MENTOR_PRACTICE_STATUSES.FAILED)
      throw new ConflictException("common.toast.somethingWentWrong");

    const updated = await this.aiRepository.queuePracticeSessionRetry(sessionId);
    if (!updated) throw new ConflictException("common.toast.somethingWentWrong");

    await this.enqueueGeneration(sessionId, currentUser.tenantId);

    return this.mapSession({ ...updated, threadId: session.threadId });
  }

  async processGenerationJob(data: AiMentorPracticeJobData): Promise<void> {
    const session = await this.aiRepository.findPracticeSessionById(data.sessionId);
    if (!session) throw new NotFoundException("common.toast.notFound");
    const claimed = await this.aiRepository.claimPracticeSessionForGeneration(session.id);
    if (!claimed) return;

    try {
      const prompt = await this.promptService.loadPrompt("aiMentorPracticeGeneration", {
        language: session.language,
        challenge: session.challenge,
        counterpart: session.counterpart,
        desiredOutcome: session.desiredOutcome,
      });
      const { generateObject, jsonSchema } = await loadAiSdk();
      const openai = await this.aiRuntimeService.getAISdkOpenAI();
      const { object } = await generateObject({
        model: openai(OPENAI_MODELS.BASIC),
        schema: jsonSchema(() => practiceGenerationSchema),
        prompt,
      });
      const output = object as { title: string; instructions: string };

      const judgeResult = await this.aiJudgeConfigurationGenerationWorkflowService.run({
        language: session.language,
        lessonContext: {
          title: output.title,
          taskDescription: output.instructions,
          aiMentorInstructions: output.instructions,
          aiMentorType: AI_MENTOR_TYPE.ROLEPLAY,
        },
        mode: AI_JUDGE_GENERATION_MODE.CREATE,
        brief: [
          "Create a concise assessment for this standalone practice conversation.",
          `Challenge: ${session.challenge}`,
          `Conversation counterpart: ${session.counterpart}`,
          `Desired outcome: ${session.desiredOutcome}`,
        ].join("\n"),
      });
      if (judgeResult.status !== AI_JUDGE_GENERATION_STATUS.COMPLETED || !judgeResult.configuration)
        throw new Error("Practice AI Judge configuration did not pass validation");

      await this.aiRepository.saveGeneratedPractice(
        session.id,
        output.title,
        output.instructions,
        this.aiPracticeJudgeConfigurationService.build(
          session.id,
          judgeResult.configuration,
          session.language,
        ),
      );
      await this.aiService.getPracticeThreadWithSetup({
        practiceSessionId: session.id,
        userId: session.userId,
        userLanguage: session.language,
      });
      await this.aiRepository.updatePracticeSession(session.id, {
        status: AI_MENTOR_PRACTICE_STATUSES.READY,
        errorCode: null,
      });
    } catch (error) {
      await this.aiRepository.updatePracticeSession(session.id, {
        status: AI_MENTOR_PRACTICE_STATUSES.FAILED,
        errorCode: "generation_failed",
      });
      throw error;
    }
  }

  private getPracticeDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async enqueueGeneration(sessionId: UUIDType, tenantId: UUIDType) {
    try {
      await this.aiPracticeQueueService.enqueue({ tenantId, sessionId });
    } catch (error) {
      await this.aiRepository.updatePracticeSession(sessionId, {
        status: AI_MENTOR_PRACTICE_STATUSES.FAILED,
        errorCode: "queue_failed",
      });
      throw error;
    }
  }

  private mapSession(session: {
    id: string;
    practiceDate: string;
    timezone: string;
    language: string;
    challenge: string;
    counterpart: string;
    desiredOutcome: string;
    generatedTitle: string | null;
    generatedInstructions: string | null;
    status: AiMentorPracticeSessionResponse["status"];
    errorCode: string | null;
    threadId?: string | null;
  }): AiMentorPracticeSessionResponse {
    return {
      id: session.id,
      practiceDate: session.practiceDate,
      timezone: session.timezone,
      language: session.language as AiMentorPracticeSessionResponse["language"],
      challenge: session.challenge,
      counterpart: session.counterpart,
      desiredOutcome: session.desiredOutcome,
      title: session.generatedTitle,
      instructions: session.generatedInstructions,
      threadId: session.threadId ?? null,
      status: session.status,
      errorCode: session.errorCode,
    };
  }
}
