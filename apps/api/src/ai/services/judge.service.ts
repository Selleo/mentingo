import { BadRequestException, Inject, Injectable } from "@nestjs/common";

import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { ChatService } from "src/ai/services/chat.service";
import { MessageService } from "src/ai/services/message.service";
import { PromptService } from "src/ai/services/prompt.service";
import { ThreadService } from "src/ai/services/thread.service";
import { MESSAGE_ROLE, THREAD_STATUS } from "src/ai/utils/ai.type";
import { evaluateAiJudgeResult } from "src/ai/utils/judgeEvaluation";
import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";

import type { PermissionKey, SupportedLanguages } from "@repo/shared";
import type {
  AiJudgeModelRubric,
  AiJudgeRubric,
  AiJudgeRubricContext,
  AiJudgePublicResult,
} from "src/ai/judge-configuration/judge-configuration.types";
import type { ThreadOwnershipBody } from "src/ai/utils/ai.schema";
import type { UUIDType } from "src/common";

type JudgeViewer = {
  userId: string;
  permissions: PermissionKey[];
};

@Injectable()
export class JudgeService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly aiRepository: AiRepository,
    private readonly aiRuntimeService: AiRuntimeService,
    private readonly chatService: ChatService,
    private readonly threadService: ThreadService,
    private readonly messageService: MessageService,
    private readonly promptService: PromptService,
  ) {}

  async runJudge(data: ThreadOwnershipBody, viewer: JudgeViewer) {
    const thread = await this.threadService.findThread(data.threadId, {
      userId: viewer.userId,
      permissions: viewer.permissions,
    });

    if (thread.data.status !== THREAD_STATUS.ACTIVE)
      throw new BadRequestException("common.error.threadMustBeActive");

    const { lessonTitle, rubric } = await this.getRubric(data.threadId, thread.data.userLanguage);

    const messages = await this.messageService.findMessageHistory(
      data.threadId,
      undefined,
      MESSAGE_ROLE.USER,
    );

    const content = [
      "<student_submission>",
      messages.history.map(({ content }) => content).join("\n"),
      "</student_submission>",
    ].join("\n");
    const assessmentConfiguration = {
      taskGoal: rubric.taskGoal,
      passingThresholdPercent: rubric.passingThresholdPercent,
      criteria: rubric.criteria.map(({ id: _id, ...criterion }, index) => ({
        ...criterion,
        criterionRef: `C${index + 1}`,
      })),
      blockingErrors: rubric.blockingErrors.map(({ id: _id, ...blockingError }, index) => ({
        ...blockingError,
        blockingErrorRef: `B${index + 1}`,
      })),
    } satisfies AiJudgeModelRubric;
    const system = await this.promptService.loadPrompt("judgePrompt", {
      lessonTitle,
      language: messages.userLanguage,
      assessmentConfiguration: JSON.stringify(assessmentConfiguration, null, 2),
    });
    const judged = await this.aiRuntimeService.judgeMentor(
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
        temperature: 0.2,
      },
      () => this.chatService.judge(system, content),
    );
    const response = evaluateAiJudgeResult(judged, rubric);

    await this.persistJudgement(data.threadId, thread.data.userLanguage, rubric, response);

    const { status } = await this.aiRepository.updateThread(data.threadId, {
      status: THREAD_STATUS.COMPLETED,
    });

    return { data: { ...response, status } };
  }

  private async getRubric(
    threadId: UUIDType,
    language: SupportedLanguages,
  ): Promise<AiJudgeRubricContext & { rubric: AiJudgeRubric }> {
    const context = await this.aiRepository.findJudgeRubricByThreadId(threadId, language);

    if (!context?.rubric) throw new BadRequestException("common.error.aiJudgeConfigurationMissing");

    return { ...context, rubric: context.rubric };
  }

  private async persistJudgement(
    threadId: UUIDType,
    language: SupportedLanguages,
    rubric: AiJudgeRubric,
    result: AiJudgePublicResult,
  ) {
    await this.db.transaction(async (transaction) => {
      const judgement = await this.aiRepository.upsertJudgeJudgement(
        {
          threadId,
          configurationId: rubric.configurationId,
          language,
          earnedPoints: result.score,
          maxScore: result.maxScore,
          percentage: result.percentage,
          passed: result.passed,
        },
        transaction,
      );

      await Promise.all([
        this.aiRepository.deleteJudgeCriterionJudgements(judgement.id, transaction),
        this.aiRepository.deleteJudgeBlockingErrorJudgements(judgement.id, transaction),
      ]);

      if (result.criteria.length)
        await this.aiRepository.insertJudgeCriterionJudgements(
          result.criteria.map((criterion) => ({
            judgementId: judgement.id,
            criterionId: criterion.criterionId,
            criterionTitle: criterion.title,
            awardedPoints: criterion.awardedScore,
            maxScoreAtJudgement: criterion.maxScore,
            status: criterion.status,
            learnerSafeFeedback: criterion.learnerSafeFeedback,
          })),
          transaction,
        );

      if (result.blockingErrors.length)
        await this.aiRepository.insertJudgeBlockingErrorJudgements(
          result.blockingErrors.map((blockingError) => ({
            judgementId: judgement.id,
            blockingErrorId: blockingError.blockingErrorId,
            blockingErrorDescription: blockingError.description,
            learnerSafeFeedback: blockingError.learnerSafeFeedback,
          })),
          transaction,
        );
    });
  }
}
