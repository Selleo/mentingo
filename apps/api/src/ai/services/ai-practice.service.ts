import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AI_MENTOR_TYPE } from "@repo/shared";

import { AiPracticeQueueService } from "src/ai/ai-practice.queue.service";
import {
  AI_MENTOR_PRACTICE_STATUSES,
  type AiMentorPracticeJobData,
} from "src/ai/ai-practice.types";
import { AI_JUDGE_GENERATION_MODE } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";
import { AiJudgeConfigurationGeneratorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generator.service";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiPracticeContentGeneratorService } from "src/ai/services/ai-practice-content-generator.service";
import { AiPracticeJudgeConfigurationService } from "src/ai/services/ai-practice-judge-configuration.service";
import { AiService } from "src/ai/services/ai.service";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { EnvService } from "src/env/services/env.service";

import type {
  AiMentorPracticeSessionResponse,
  CreateAiMentorPracticeBody,
} from "src/ai/ai-practice.schema";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AiPracticeService {
  constructor(
    private readonly aiRepository: AiRepository,
    private readonly aiPracticeQueueService: AiPracticeQueueService,
    private readonly aiPracticeJudgeConfigurationService: AiPracticeJudgeConfigurationService,
    private readonly aiPracticeContentGeneratorService: AiPracticeContentGeneratorService,
    private readonly aiJudgeConfigurationGeneratorService: AiJudgeConfigurationGeneratorService,
    private readonly aiService: AiService,
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

    const scenario = body.scenario.trim();
    if (!scenario) throw new BadRequestException("common.validation.required");

    const practiceDate = this.getPracticeDate();

    const session = await this.aiRepository.createPracticeSession({
      userId: currentUser.userId,
      practiceDate,
      language: body.language,
      instructions: scenario,
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

  async replay(
    sessionId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<AiMentorPracticeSessionResponse> {
    const session = await this.aiRepository.findPracticeSessionById(sessionId);
    if (!session) throw new NotFoundException("common.toast.notFound");
    if (session.userId !== currentUser.userId)
      throw new ForbiddenException("common.toast.noAccess");
    if (
      session.status !== AI_MENTOR_PRACTICE_STATUSES.READY ||
      session.threadStatus !== THREAD_STATUS.COMPLETED
    )
      throw new ConflictException("common.toast.somethingWentWrong");

    await this.aiRepository.resetPracticeConversation(session.id);
    await this.aiService.getPracticeThreadWithSetup({
      practiceSessionId: session.id,
      userId: session.userId,
      userLanguage: session.language,
      practiceInstructions: session.instructions,
    });

    const replayed = await this.aiRepository.findPracticeSessionById(session.id);
    if (!replayed) throw new NotFoundException("common.toast.notFound");
    return this.mapSession(replayed);
  }

  async processGenerationJob(data: AiMentorPracticeJobData): Promise<void> {
    const session = await this.aiRepository.findPracticeSessionById(data.sessionId);
    if (!session) throw new NotFoundException("common.toast.notFound");
    const claimed = await this.aiRepository.claimPracticeSessionForGeneration(session.id);
    if (!claimed) return;

    try {
      const content = await this.aiPracticeContentGeneratorService.generate({
        language: session.language,
        learnerRequest: session.instructions,
      });
      const judgeConfiguration = await this.aiJudgeConfigurationGeneratorService.generate({
        language: session.language,
        lessonContext: {
          title: content.title,
          taskDescription: content.instructions,
          aiMentorInstructions: content.instructions,
          aiMentorType: AI_MENTOR_TYPE.ROLEPLAY,
        },
        mode: AI_JUDGE_GENERATION_MODE.CREATE,
        brief: content.instructions,
      });

      await this.aiRepository.saveGeneratedPractice(
        session.id,
        content.title,
        content.aiMentorName,
        content.instructions,
        this.aiPracticeJudgeConfigurationService.build(
          session.id,
          judgeConfiguration,
          session.language,
        ),
      );
      await this.aiService.getPracticeThreadWithSetup({
        practiceSessionId: session.id,
        userId: session.userId,
        userLanguage: session.language,
        practiceInstructions: content.instructions,
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
    language: AiMentorPracticeSessionResponse["language"];
    title: string | null;
    aiMentorName: string | null;
    status: AiMentorPracticeSessionResponse["status"];
    errorCode: string | null;
    threadId?: string | null;
    threadStatus?: AiMentorPracticeSessionResponse["threadStatus"];
    taskGoal?: string | null;
    evaluation?: AiMentorPracticeSessionResponse["evaluation"];
  }): AiMentorPracticeSessionResponse {
    return {
      id: session.id,
      practiceDate: session.practiceDate,
      language: session.language,
      title: session.title,
      aiMentorName: session.aiMentorName ?? null,
      threadId: session.threadId ?? null,
      threadStatus: session.threadStatus ?? null,
      taskGoal: session.taskGoal ?? null,
      evaluation: session.evaluation ?? null,
      status: session.status,
      errorCode: session.errorCode,
    };
  }
}
