import { randomUUID } from "node:crypto";

import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ASSISTANT_RUN_ACTIVITIES } from "@repo/shared";
import { and, asc, count, desc, eq, gt, ilike, inArray, isNotNull, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { assistantMessages, assistantRuns, assistantThreads } from "src/storage/schema";

import { getAssistantMessageOrder } from "./assistant-message-order";

import type {
  AssistantPageInput,
  AssistantRunIdentity,
  AssistantRunCursor,
  AssistantRunUpdate,
  AssistantSendResult,
} from "./assistant.types";
import type { SupportedLanguages } from "@repo/shared";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AssistantRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  private owner(user: CurrentUserType, threadId?: string) {
    return and(
      eq(assistantThreads.tenantId, user.tenantId),
      eq(assistantThreads.userId, user.userId),
      threadId ? eq(assistantThreads.id, threadId) : undefined,
    );
  }

  async listThreads(
    user: CurrentUserType,
    input: AssistantPageInput & { archived?: boolean; query?: string },
  ) {
    const { page = 1, perPage = 30 } = input;
    const filter = and(
      this.owner(user),
      eq(assistantThreads.archived, input.archived ?? false),
      input.query
        ? ilike(assistantThreads.title, `%${input.query.replace(/[\\%_]/g, "\\$&")}%`)
        : undefined,
    );
    const [items, totals] = await Promise.all([
      this.db
        .select()
        .from(assistantThreads)
        .where(filter)
        .orderBy(desc(assistantThreads.updatedAt), desc(assistantThreads.id))
        .limit(perPage)
        .offset((page - 1) * perPage),
      this.db.select({ total: count() }).from(assistantThreads).where(filter),
    ]);
    return { items, page, perPage, totalItems: totals[0].total };
  }

  async createThread(
    user: CurrentUserType,
    input: { title?: string; language: SupportedLanguages },
  ) {
    const [thread] = await this.db
      .insert(assistantThreads)
      .values({
        tenantId: user.tenantId,
        userId: user.userId,
        title: input.title?.trim() || "New conversation",
        language: input.language,
      })
      .returning();
    return thread;
  }

  async getThread(user: CurrentUserType, threadId: string) {
    const [thread] = await this.db
      .select()
      .from(assistantThreads)
      .where(this.owner(user, threadId))
      .limit(1);
    if (!thread) throw new NotFoundException("Assistant conversation not found");
    const [latestRun] = await this.db
      .select()
      .from(assistantRuns)
      .where(
        and(
          eq(assistantRuns.tenantId, user.tenantId),
          eq(assistantRuns.userId, user.userId),
          eq(assistantRuns.threadId, threadId),
        ),
      )
      .orderBy(desc(assistantRuns.createdAt), desc(assistantRuns.id))
      .limit(1);
    return { ...thread, latestRun: latestRun ?? null };
  }

  async updateThread(
    user: CurrentUserType,
    threadId: string,
    input: { title?: string; archived?: boolean },
  ) {
    await this.getThread(user, threadId);
    if (input.title === undefined && input.archived === undefined)
      return this.getThread(user, threadId);
    const [thread] = await this.db
      .update(assistantThreads)
      .set({ ...input, title: input.title?.trim(), updatedAt: new Date().toISOString() })
      .where(this.owner(user, threadId))
      .returning();
    if (!thread) throw new NotFoundException("Assistant conversation not found");
    return this.getThread(user, threadId);
  }

  async listMessages(user: CurrentUserType, threadId: string, input: AssistantPageInput) {
    const thread = await this.getThread(user, threadId);
    const { page = 1, perPage = 50 } = input;
    const filter = and(
      eq(assistantMessages.tenantId, user.tenantId),
      eq(assistantMessages.threadId, threadId),
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(assistantMessages)
        .where(filter)
        .orderBy(...getAssistantMessageOrder("desc"))
        .limit(perPage)
        .offset((page - 1) * perPage),
      this.db.select({ total: count() }).from(assistantMessages).where(filter),
    ]);
    return {
      items: rows.reverse(),
      page,
      perPage,
      totalItems: totals[0].total,
      latestRun: thread.latestRun,
    };
  }

  async createSend(
    user: CurrentUserType,
    threadId: string,
    input: { clientMessageId: string; text: string; language: SupportedLanguages },
    origin: string,
  ): Promise<AssistantSendResult> {
    return this.tenantDbRunnerService.transaction(async () => {
      const [thread] = await this.db
        .select()
        .from(assistantThreads)
        .where(this.owner(user, threadId))
        .for("update");
      if (!thread) throw new NotFoundException("Assistant conversation not found");
      const [existing] = await this.db
        .select()
        .from(assistantMessages)
        .where(
          and(
            eq(assistantMessages.tenantId, user.tenantId),
            eq(assistantMessages.threadId, threadId),
            eq(assistantMessages.clientMessageId, input.clientMessageId),
          ),
        )
        .limit(1);
      if (existing) {
        const [run] = await this.db
          .select()
          .from(assistantRuns)
          .where(
            and(
              eq(assistantRuns.tenantId, user.tenantId),
              eq(assistantRuns.userMessageId, existing.id),
              eq(assistantRuns.userId, user.userId),
            ),
          )
          .limit(1);
        if (!run || existing.text !== input.text.trim() || run.language !== input.language)
          throw new ConflictException("Idempotency key was used for a different message");
        const [assistantMessage] = await this.db
          .select()
          .from(assistantMessages)
          .where(
            and(
              eq(assistantMessages.tenantId, user.tenantId),
              eq(assistantMessages.id, run.assistantMessageId),
            ),
          )
          .limit(1);
        return { userMessage: existing, assistantMessage, run };
      }
      if (thread.archived)
        throw new ConflictException("Unarchive this conversation before sending a message");
      const [active] = await this.db
        .select({ id: assistantRuns.id })
        .from(assistantRuns)
        .where(
          and(
            eq(assistantRuns.tenantId, user.tenantId),
            eq(assistantRuns.threadId, threadId),
            inArray(assistantRuns.status, ["pending", "running"]),
          ),
        )
        .limit(1);
      if (active) throw new ConflictException("A response is already running in this conversation");
      const now = Date.now();
      const [userMessage] = await this.db
        .insert(assistantMessages)
        .values({
          tenantId: user.tenantId,
          threadId,
          role: "user",
          text: input.text.trim(),
          clientMessageId: input.clientMessageId,
          createdAt: new Date(now).toISOString(),
        })
        .returning();
      const [assistantMessage] = await this.db
        .insert(assistantMessages)
        .values({
          tenantId: user.tenantId,
          threadId,
          role: "assistant",
          status: "pending",
          createdAt: new Date(now + 1).toISOString(),
        })
        .returning();
      const [run] = await this.db
        .insert(assistantRuns)
        .values({
          id: randomUUID(),
          tenantId: user.tenantId,
          threadId,
          userId: user.userId,
          userMessageId: userMessage.id,
          assistantMessageId: assistantMessage.id,
          language: input.language,
          origin,
          activity: ASSISTANT_RUN_ACTIVITIES.STARTING,
        })
        .returning();
      await this.db
        .update(assistantThreads)
        .set({
          title:
            thread.title === "New conversation" ? input.text.trim().slice(0, 100) : thread.title,
          language: input.language,
          updatedAt: new Date(now).toISOString(),
        })
        .where(this.owner(user, threadId));
      return { userMessage, assistantMessage, run };
    });
  }

  async getRun({ tenantId, runId }: AssistantRunIdentity) {
    return this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      const [run] = await this.db
        .select()
        .from(assistantRuns)
        .where(and(eq(assistantRuns.tenantId, tenantId), eq(assistantRuns.id, runId)))
        .limit(1);
      if (!run) throw new NotFoundException("Assistant run not found");
      return run;
    });
  }

  async getHistory(input: AssistantRunIdentity) {
    return this.tenantDbRunnerService.runWithTenant(input.tenantId, async () => {
      const run = await this.getRun(input);
      const messages = await this.db
        .select()
        .from(assistantMessages)
        .where(
          and(
            eq(assistantMessages.tenantId, input.tenantId),
            eq(assistantMessages.threadId, run.threadId),
            inArray(assistantMessages.status, ["complete"]),
          ),
        )
        .orderBy(...getAssistantMessageOrder("desc"))
        .limit(100);
      return messages.reverse();
    });
  }

  async bindWorkflow(input: AssistantRunIdentity, workflowRunId: string) {
    return this.tenantDbRunnerService.runWithTenant(input.tenantId, () =>
      this.db
        .update(assistantRuns)
        .set({ workflowRunId, updatedAt: new Date().toISOString() })
        .where(
          and(
            eq(assistantRuns.tenantId, input.tenantId),
            eq(assistantRuns.id, input.runId),
            sql`${assistantRuns.workflowRunId} IS NULL`,
          ),
        ),
    );
  }

  async updateRun(input: AssistantRunIdentity, update: AssistantRunUpdate) {
    return this.tenantDbRunnerService.runWithTenantTransaction(input.tenantId, async () => {
      const [run] = await this.db
        .select()
        .from(assistantRuns)
        .where(and(eq(assistantRuns.tenantId, input.tenantId), eq(assistantRuns.id, input.runId)))
        .for("update");
      if (!run) throw new NotFoundException("Assistant run not found");
      if (!["pending", "running"].includes(run.status)) return run;
      const now = new Date().toISOString();
      const sources = update.sources
        ? [
            ...new Map(
              [...run.sources, ...update.sources].map((source) => [source.url, source]),
            ).values(),
          ].slice(0, 100)
        : undefined;
      const [updated] = await this.db
        .update(assistantRuns)
        .set({
          status: update.status,
          activity:
            update.status && ["completed", "failed", "cancelled"].includes(update.status)
              ? null
              : update.activity,
          sources,
          errorCode: update.errorCode,
          successfulToolCalls: update.recordTool ? run.successfulToolCalls + 1 : undefined,
          readableToolCalls: update.recordTool?.readable ? run.readableToolCalls + 1 : undefined,
          updatedAt: now,
        })
        .where(and(eq(assistantRuns.tenantId, input.tenantId), eq(assistantRuns.id, input.runId)))
        .returning();
      const messageStatus = update.status === "completed" ? "complete" : update.status;
      await this.db
        .update(assistantMessages)
        .set({
          status: messageStatus,
          text: update.text,
          sources: update.messageSources,
          updatedAt: now,
        })
        .where(
          and(
            eq(assistantMessages.tenantId, input.tenantId),
            eq(assistantMessages.threadId, run.threadId),
            eq(assistantMessages.id, run.assistantMessageId),
          ),
        );
      await this.db
        .update(assistantThreads)
        .set({ updatedAt: now })
        .where(
          and(
            eq(assistantThreads.tenantId, input.tenantId),
            eq(assistantThreads.userId, run.userId),
            eq(assistantThreads.id, run.threadId),
          ),
        );
      return updated;
    });
  }

  async boundActiveRuns(tenantId: string, after?: AssistantRunCursor) {
    return this.tenantDbRunnerService.runWithTenant(tenantId, () =>
      this.db
        .select({
          id: assistantRuns.id,
          createdAt: assistantRuns.createdAt,
          workflowRunId: assistantRuns.workflowRunId,
        })
        .from(assistantRuns)
        .where(
          and(
            eq(assistantRuns.tenantId, tenantId),
            inArray(assistantRuns.status, ["pending", "running"]),
            isNotNull(assistantRuns.workflowRunId),
            sql`${assistantRuns.updatedAt} < CURRENT_TIMESTAMP - interval '15 seconds'`,
            after
              ? or(
                  gt(assistantRuns.createdAt, after.createdAt),
                  and(eq(assistantRuns.createdAt, after.createdAt), gt(assistantRuns.id, after.id)),
                )
              : undefined,
          ),
        )
        .orderBy(asc(assistantRuns.createdAt), asc(assistantRuns.id))
        .limit(20),
    );
  }

  async pendingRuns(tenantId: string) {
    return this.tenantDbRunnerService.runWithTenant(tenantId, () =>
      this.db
        .select()
        .from(assistantRuns)
        .where(
          and(
            eq(assistantRuns.tenantId, tenantId),
            eq(assistantRuns.status, "pending"),
            sql`${assistantRuns.workflowRunId} IS NULL`,
            sql`${assistantRuns.createdAt} < CURRENT_TIMESTAMP - interval '15 seconds'`,
          ),
        )
        .orderBy(asc(assistantRuns.createdAt))
        .limit(20),
    );
  }
}
