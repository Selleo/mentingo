import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { assistantMessages, assistantThreads, users } from "src/storage/schema";

import type { ExternalConversationInput } from "./external-conversations.schema";
import type { McpToolActor } from "./mcp.types";

@Injectable()
export class ExternalConversationsRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async append(actor: McpToolActor, input: ExternalConversationInput) {
    const { tenantId, userId, clientId } = actor.grant;
    return this.tenantDbRunnerService.runWithTenantTransaction(tenantId, async () => {
      const [user] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, userId),
            eq(users.tenantId, tenantId),
            eq(users.archived, false),
            isNull(users.deletedAt),
          ),
        )
        .limit(1);
      if (!user) throw new ForbiddenException("Inactive Slack connection account");
      // The authenticated client/account namespace prevents cross-pairing overwrites.
      const [thread] = await this.db
        .insert(assistantThreads)
        .values({
          tenantId,
          userId,
          externalClientId: clientId,
          externalThreadKey: input.threadKey,
          source: input.source,
          title: input.title || input.messages[0].text.slice(0, 200),
          language: input.language ?? SUPPORTED_LANGUAGES.EN,
        })
        .onConflictDoUpdate({
          target: [
            assistantThreads.tenantId,
            assistantThreads.userId,
            assistantThreads.externalClientId,
            assistantThreads.source,
            assistantThreads.externalThreadKey,
          ],
          set: {
            updatedAt: new Date().toISOString(),
            ...(input.title ? { title: input.title } : {}),
          },
        })
        .returning({ id: assistantThreads.id });
      await this.db
        .insert(assistantMessages)
        .values(
          input.messages.map((message) => ({
            tenantId,
            threadId: thread.id,
            externalMessageId: message.externalId,
            role: message.role,
            text: message.text,
            createdAt: message.createdAt,
            externalUserId: message.participantId,
            externalUserName: message.participantName,
          })),
        )
        .onConflictDoNothing({
          target: [
            assistantMessages.tenantId,
            assistantMessages.threadId,
            assistantMessages.externalMessageId,
          ],
        });
      return { id: thread.id };
    });
  }
}
