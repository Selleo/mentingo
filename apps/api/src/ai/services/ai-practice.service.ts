import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Type } from "@sinclair/typebox";

import {
  AI_MENTOR_PRACTICE_STATUSES,
  type AiMentorPracticeJobData,
} from "src/ai/ai-practice.types";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { AiService } from "src/ai/services/ai.service";
import { PromptService } from "src/ai/services/prompt.service";
import { loadAiSdk } from "src/ai/utils/ai-esm";
import { OPENAI_MODELS } from "src/ai/utils/ai.type";
import { DatabasePg, type UUIDType } from "src/common";
import { EnvService } from "src/env/services/env.service";
import { AiMentorPracticeRequestedEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { DB } from "src/storage/db/db.providers";

import type {
  AiMentorPracticeSessionResponse,
  CreateAiMentorPracticeBody,
} from "src/ai/ai-practice.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

const practiceGenerationSchema = Type.Object({
  title: Type.String({ minLength: 1, maxLength: 160 }),
  instructions: Type.String({ minLength: 1, maxLength: 6000 }),
});

@Injectable()
export class AiPracticeService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly aiRepository: AiRepository,
    private readonly aiRuntimeService: AiRuntimeService,
    private readonly aiService: AiService,
    private readonly promptService: PromptService,
    private readonly envService: EnvService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async getToday(
    timezone: string,
    currentUser: CurrentUserType,
  ): Promise<AiMentorPracticeSessionResponse | null> {
    const practiceDate = this.getPracticeDate(timezone);
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

    const practiceDate = this.getPracticeDate(body.timezone);

    const session = await this.db.transaction(async (trx) => {
      const created = await this.aiRepository.createPracticeSession(
        {
          userId: currentUser.userId,
          practiceDate,
          timezone: body.timezone,
          language: body.language,
          ...answers,
        },
        trx,
      );

      if (!created) return null;

      await this.outboxPublisher.publish(
        new AiMentorPracticeRequestedEvent({
          tenantId: currentUser.tenantId,
          sessionId: created.id,
        }),
        trx,
      );

      return created;
    });

    if (!session) {
      const existing = await this.aiRepository.findPracticeSessionByDate(
        currentUser.userId,
        practiceDate,
      );
      if (!existing) throw new ConflictException("AI Mentor practice already exists");
      return this.mapSession(existing);
    }

    return this.mapSession({ ...session, threadId: null });
  }

  async getById(
    sessionId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<AiMentorPracticeSessionResponse> {
    const session = await this.aiRepository.findPracticeSessionById(sessionId);
    if (!session) throw new NotFoundException("AI Mentor practice not found");
    if (session.userId !== currentUser.userId)
      throw new ForbiddenException("You don't have access to this AI Mentor practice");

    return this.mapSession(session);
  }

  async retry(
    sessionId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<AiMentorPracticeSessionResponse> {
    const session = await this.aiRepository.findPracticeSessionById(sessionId);
    if (!session) throw new NotFoundException("AI Mentor practice not found");
    if (session.userId !== currentUser.userId)
      throw new ForbiddenException("You don't have access to this AI Mentor practice");
    if (session.status !== AI_MENTOR_PRACTICE_STATUSES.FAILED)
      throw new ConflictException("Only a failed AI Mentor practice can be retried");

    const updated = await this.db.transaction(async (trx) => {
      const row = await this.aiRepository.updatePracticeSession(
        sessionId,
        {
          status: AI_MENTOR_PRACTICE_STATUSES.QUEUED,
          errorCode: null,
        },
        trx,
      );

      await this.outboxPublisher.publish(
        new AiMentorPracticeRequestedEvent({
          tenantId: currentUser.tenantId,
          sessionId,
        }),
        trx,
      );

      return row;
    });

    return this.mapSession({ ...updated, threadId: session.threadId });
  }

  async processGenerationJob(data: AiMentorPracticeJobData): Promise<void> {
    const session = await this.aiRepository.findPracticeSessionById(data.sessionId);
    if (!session) throw new NotFoundException("AI Mentor practice not found");
    if (session.status === AI_MENTOR_PRACTICE_STATUSES.READY) return;

    await this.aiRepository.updatePracticeSession(session.id, {
      status: AI_MENTOR_PRACTICE_STATUSES.PROCESSING,
      errorCode: null,
    });

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

      await this.aiRepository.updatePracticeSession(session.id, {
        generatedTitle: output.title,
        generatedInstructions: output.instructions,
      });
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

  private getPracticeDate(timezone: string): string {
    try {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${values.year}-${values.month}-${values.day}`;
    } catch {
      throw new BadRequestException("common.validation.invalidTimezone");
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
