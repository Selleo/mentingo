import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import {
  ASSISTANT_RUN_STATUSES,
  ASSISTANT_WORKFLOW_RUN_STATES,
  ASSISTANT_RUN_ERROR_CODES,
} from "@repo/shared";
import { match } from "ts-pattern";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { AssistantRepository } from "./assistant.repository";
import { DEFAULT_ASSISTANT_LANGUAGE } from "./schemas/assistant.schema";
import { AssistantRuntimeService } from "./workflow/assistant-runtime.service";

import type { AssistantRun, AssistantRunCursor } from "./assistant.types";
import type {
  AssistantPageQuery,
  AssistantThreadListQuery,
  CreateAssistantThread,
  SendAssistantMessage,
  UpdateAssistantThread,
} from "./schemas/assistant.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private recovering = false;
  private readonly reconciliationCursors = new Map<string, AssistantRunCursor>();
  constructor(
    private readonly assistantRepository: AssistantRepository,
    private readonly assistantRuntimeService: AssistantRuntimeService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  private async requireActor(user: CurrentUserType) {
    const account = await this.assistantRepository.isAccountActive(user);
    if (!account) throw new ForbiddenException("common.toast.noAccess");
  }

  async availability(user: CurrentUserType) {
    await this.requireActor(user);
    return {
      available: this.assistantRuntimeService.isAvailable(),
      reason: this.assistantRuntimeService.isAvailable()
        ? null
        : ASSISTANT_RUN_ERROR_CODES.WORKFLOW_UNAVAILABLE,
    };
  }

  async listThreads(user: CurrentUserType, query: AssistantThreadListQuery) {
    await this.requireActor(user);
    return this.assistantRepository.listThreads(user, query);
  }
  async createThread(user: CurrentUserType, body: CreateAssistantThread) {
    await this.requireActor(user);
    return this.assistantRepository.createThread(user, {
      ...body,
      language: body.language ?? DEFAULT_ASSISTANT_LANGUAGE,
    });
  }
  async getThread(user: CurrentUserType, threadId: string) {
    await this.requireActor(user);
    return this.assistantRepository.getThread(user, threadId);
  }
  async updateThread(user: CurrentUserType, threadId: string, body: UpdateAssistantThread) {
    await this.requireActor(user);
    return this.assistantRepository.updateThread(user, threadId, body);
  }
  async listMessages(user: CurrentUserType, threadId: string, query: AssistantPageQuery) {
    await this.requireActor(user);
    return this.assistantRepository.listMessages(user, threadId, query);
  }

  async sendMessage(user: CurrentUserType, threadId: string, body: SendAssistantMessage) {
    await this.requireActor(user);
    if (!this.assistantRuntimeService.isAvailable())
      throw new ServiceUnavailableException("assistant.errors.unavailable");
    const tenant = await this.assistantRepository.findTenantState(user.tenantId);
    if (!tenant?.host) throw new ServiceUnavailableException("assistant.errors.unavailable");
    const origin = new URL(tenant.host).origin;
    const sent = await this.assistantRepository.createSend(user, threadId, body, origin);
    if (sent.run.status === ASSISTANT_RUN_STATUSES.PENDING && !sent.run.workflowRunId) {
      try {
        await this.start(sent.run);
      } catch {
        // A pending claim is durable; the recovery task retries an interrupted handoff.
        this.logger.warn(`Assistant workflow handoff pending for ${sent.run.id}`);
      }
    }
    return {
      ...sent,
      run: await this.assistantRepository.getRun({ tenantId: user.tenantId, runId: sent.run.id }),
    };
  }

  private async start(run: AssistantRun) {
    const result = await this.assistantRuntimeService.start({
      runId: run.id,
      createdAt: run.createdAt,
      tenantId: run.tenantId,
      threadId: run.threadId,
      userId: run.userId,
      language: run.language,
      origin: run.origin,
    });
    await this.assistantRepository.bindWorkflow(
      { tenantId: run.tenantId, runId: run.id },
      result.workflowRunId,
    );
  }

  async cancelRun(user: CurrentUserType, threadId: string, runId: string) {
    await this.requireActor(user);
    await this.assistantRepository.getThread(user, threadId);
    const run = await this.assistantRepository.getRun({ tenantId: user.tenantId, runId });
    if (run.threadId !== threadId || run.userId !== user.userId)
      throw new NotFoundException("common.toast.notFound");
    const cancelled = await this.assistantRepository.updateRun(
      { tenantId: user.tenantId, runId },
      { status: ASSISTANT_RUN_STATUSES.CANCELLED },
    );
    if (
      run.workflowRunId &&
      (run.status === ASSISTANT_RUN_STATUSES.PENDING ||
        run.status === ASSISTANT_RUN_STATUSES.RUNNING)
    ) {
      try {
        await this.assistantRuntimeService.cancel(run.workflowRunId);
      } catch {
        this.logger.warn(`Assistant workflow cancellation pending for ${runId}`);
      }
    }
    return cancelled;
  }

  private async reconcileBoundRuns(tenantId: string) {
    const cursor = this.reconciliationCursors.get(tenantId);
    let runs = await this.assistantRepository.boundActiveRuns(tenantId, cursor);
    if (!runs.length && cursor) {
      this.reconciliationCursors.delete(tenantId);
      runs = await this.assistantRepository.boundActiveRuns(tenantId);
    }
    for (const run of runs) {
      try {
        const state = await this.assistantRuntimeService.getRunState(run.workflowRunId!);
        const update = match(state)
          .with(ASSISTANT_WORKFLOW_RUN_STATES.CANCELLED, () => ({
            status: ASSISTANT_RUN_STATUSES.CANCELLED,
          }))
          .with(ASSISTANT_WORKFLOW_RUN_STATES.FAILED, () => ({
            status: ASSISTANT_RUN_STATUSES.FAILED,
            errorCode: ASSISTANT_RUN_ERROR_CODES.WORKFLOW_FAILED,
          }))
          .with(ASSISTANT_WORKFLOW_RUN_STATES.MISSING, () => ({
            status: ASSISTANT_RUN_STATUSES.FAILED,
            errorCode: ASSISTANT_RUN_ERROR_CODES.WORKFLOW_NOT_FOUND,
          }))
          .with(ASSISTANT_WORKFLOW_RUN_STATES.COMPLETED, () => ({
            status: ASSISTANT_RUN_STATUSES.FAILED,
            errorCode: ASSISTANT_RUN_ERROR_CODES.WORKFLOW_COMPLETION_NOT_SAVED,
          }))
          .otherwise(() => null);
        if (update) {
          // updateRun locks the Core row and ignores terminal rows, protecting
          // cancellation/completion races while retaining saved text/sources.
          await this.assistantRepository.updateRun({ tenantId, runId: run.id }, update);
        }
      } catch {
        this.logger.warn(`Assistant workflow state reconciliation deferred for ${run.id}`);
      }
    }
    const last = runs[runs.length - 1];
    if (last) this.reconciliationCursors.set(tenantId, { id: last.id, createdAt: last.createdAt });
  }

  @Interval(15000)
  async recoverPendingRuns() {
    if (this.recovering || !this.assistantRuntimeService.isAvailable()) return;
    this.recovering = true;
    try {
      await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
        await this.reconcileBoundRuns(tenantId);
        for (const run of await this.assistantRepository.pendingRuns(tenantId)) {
          try {
            await this.start(run);
          } catch {
            this.logger.warn(`Assistant recovery could not start ${run.id}`);
          }
        }
      });
    } catch {
      this.logger.warn("Assistant recovery scan failed");
    } finally {
      this.recovering = false;
    }
  }
}
