import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { AdminAiThreadsRepository } from "src/ai/repositories/admin-ai-threads.repository";
import { processInBatches } from "src/common/utils/processInBatches";
import { FileService } from "src/file/file.service";

import type {
  AdminAiThreadEvaluation,
  AdminAiThreadPagination,
  AdminAiThreadQuery,
} from "src/ai/admin-ai-threads.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class AdminAiThreadsService {
  private static readonly AVATAR_URL_BATCH_SIZE = 10;

  constructor(
    private readonly adminAiThreadsRepository: AdminAiThreadsRepository,
    private readonly fileService: FileService,
  ) {}

  async getThreadSummaries(adminAiThreadQuery: AdminAiThreadQuery) {
    if (
      adminAiThreadQuery.from &&
      adminAiThreadQuery.to &&
      new Date(adminAiThreadQuery.from) >= new Date(adminAiThreadQuery.to)
    ) {
      throw new BadRequestException("aiConversations.errors.invalidDateRange");
    }
    const paginatedThreadSummaries =
      await this.adminAiThreadsRepository.getThreadSummaries(adminAiThreadQuery);
    const avatarReferences = [
      ...new Set(
        paginatedThreadSummaries.data
          .map((threadSummary) => threadSummary.owner.avatarReference)
          .filter((avatarReference): avatarReference is string => Boolean(avatarReference)),
      ),
    ];
    const avatarUrlEntries = await processInBatches(
      avatarReferences,
      async (avatarReference) =>
        [avatarReference, await this.fileService.getFileUrl(avatarReference)] as const,
      { batchSize: AdminAiThreadsService.AVATAR_URL_BATCH_SIZE },
    );
    const avatarUrlsByReference = new Map(avatarUrlEntries);
    return {
      ...paginatedThreadSummaries,
      data: paginatedThreadSummaries.data.map(({ owner: threadOwner, ...threadSummary }) => ({
        ...threadSummary,
        owner: {
          id: threadOwner.id,
          firstName: threadOwner.firstName,
          lastName: threadOwner.lastName,
          profilePictureUrl: threadOwner.avatarReference
            ? (avatarUrlsByReference.get(threadOwner.avatarReference) ?? null)
            : null,
        },
      })),
    };
  }

  async getThread(threadId: UUIDType, adminAiThreadQuery: AdminAiThreadQuery = {}) {
    const threadSummary = await this.adminAiThreadsRepository.findThreadSummaryById(
      threadId,
      adminAiThreadQuery,
    );
    if (!threadSummary) throw new NotFoundException("common.toast.notFound");
    const { owner: threadOwner, ...threadMetadata } = threadSummary;
    return {
      ...threadMetadata,
      owner: {
        id: threadOwner.id,
        firstName: threadOwner.firstName,
        lastName: threadOwner.lastName,
        profilePictureUrl: threadOwner.avatarReference
          ? await this.fileService.getFileUrl(threadOwner.avatarReference)
          : null,
      },
      evaluation: await this.buildThreadEvaluation(threadId),
    };
  }

  async getThreadMessages(threadId: UUIDType, adminAiThreadPagination: AdminAiThreadPagination) {
    const threadSummary = await this.adminAiThreadsRepository.findThreadSummaryById(threadId);
    if (!threadSummary) throw new NotFoundException("common.toast.notFound");
    return this.adminAiThreadsRepository.getThreadMessages(
      threadId,
      adminAiThreadPagination.page,
      adminAiThreadPagination.perPage,
    );
  }

  private async buildThreadEvaluation(threadId: UUIDType): Promise<AdminAiThreadEvaluation | null> {
    const judgement = await this.adminAiThreadsRepository.findThreadJudgementByThreadId(threadId);
    if (!judgement) return null;

    const [judgementCriteria, judgementBlockingErrors] = await Promise.all([
      this.adminAiThreadsRepository.getThreadJudgementCriteria(judgement.id),
      this.adminAiThreadsRepository.getThreadJudgementBlockingErrors(judgement.id),
    ]);

    return {
      passed: judgement.passed,
      score: judgement.earnedPoints,
      maxScore: judgement.maxScore,
      percentage: judgement.percentage,
      criteria: judgementCriteria,
      blockingErrors: judgementBlockingErrors,
    };
  }
}
