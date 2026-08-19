import { propagateAttributes } from "@langfuse/tracing";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AI_MENTOR_PRACTICE_ERROR_CODES,
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_TYPE,
} from "@repo/shared";

import { AiPracticeQueueService } from "src/ai/ai-practice.queue.service";
import {
  AI_MENTOR_PRACTICE_STATUSES,
  type AiMentorPracticeJobData,
} from "src/ai/ai-practice.types";
import { AI_JUDGE_GENERATION_MODE } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";
import { AiJudgeConfigurationGeneratorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generator.service";
import { AI_MENTOR_CONFIGURATION_GENERATION_PURPOSE } from "src/ai/mentor-configuration-generation/ai-mentor-configuration-generation.constants";
import { AiMentorConfigurationGeneratorService } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-generator.service";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiService } from "src/ai/services/ai.service";
import { THREAD_STATUS } from "src/ai/utils/ai.type";
import { buildAiPracticeJudgeConfiguration } from "src/ai/utils/build-ai-practice-judge-configuration";
import { buildAiPracticeMentorConfiguration } from "src/ai/utils/build-ai-practice-mentor-configuration";
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
    private readonly aiMentorConfigurationGeneratorService: AiMentorConfigurationGeneratorService,
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
      scenario,
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
    const session = await this.getOwnedSession(sessionId, currentUser);

    return this.mapSession(session);
  }

  async retry(
    sessionId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<AiMentorPracticeSessionResponse> {
    const session = await this.getOwnedSession(sessionId, currentUser);
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
    const session = await this.getOwnedSession(sessionId, currentUser);
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
      const title = session.scenario.slice(0, 160).trim();
      const lessonContext = {
        title,
        taskDescription: session.scenario,
      };
      const mentorConfiguration = await propagateAttributes(
        {
          sessionId: session.id,
          metadata: { practiceSessionId: session.id },
        },
        () =>
          this.aiMentorConfigurationGeneratorService.generate({
            configurationType: AI_MENTOR_TYPE.ROLEPLAY,
            language: session.language,
            lessonContext,
            mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
            brief: session.scenario,
            generationPurpose: AI_MENTOR_CONFIGURATION_GENERATION_PURPOSE.STANDALONE_PRACTICE,
          }),
      );
      if (mentorConfiguration.type !== AI_MENTOR_TYPE.ROLEPLAY)
        throw new Error("Practice AI Mentor generator returned a non-roleplay configuration");

      const judgeConfiguration = await propagateAttributes(
        {
          sessionId: session.id,
          metadata: { practiceSessionId: session.id },
        },
        () =>
          this.aiJudgeConfigurationGeneratorService.generate({
            language: session.language,
            lessonContext: {
              ...lessonContext,
              aiMentorConfiguration: mentorConfiguration,
            },
            mode: AI_JUDGE_GENERATION_MODE.CREATE,
            brief: session.scenario,
          }),
      );

      await this.aiRepository.saveGeneratedPractice(
        session.id,
        title,
        mentorConfiguration.aiRole.slice(0, 120).trim(),
        buildAiPracticeMentorConfiguration(session.id, mentorConfiguration, session.language),
        buildAiPracticeJudgeConfiguration(session.id, judgeConfiguration, session.language),
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
        errorCode: AI_MENTOR_PRACTICE_ERROR_CODES.GENERATION_FAILED,
      });
      throw error;
    }
  }

  private getPracticeDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async getOwnedSession(sessionId: UUIDType, currentUser: CurrentUserType) {
    const session = await this.aiRepository.findPracticeSessionById(sessionId);
    if (!session) throw new NotFoundException("common.toast.notFound");
    if (session.userId !== currentUser.userId) {
      throw new ForbiddenException("common.toast.noAccess");
    }

    return session;
  }

  private async enqueueGeneration(sessionId: UUIDType, tenantId: UUIDType) {
    try {
      await this.aiPracticeQueueService.enqueue({ tenantId, sessionId });
    } catch (error) {
      await this.aiRepository.updatePracticeSession(sessionId, {
        status: AI_MENTOR_PRACTICE_STATUSES.FAILED,
        errorCode: AI_MENTOR_PRACTICE_ERROR_CODES.QUEUE_FAILED,
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
