import { Inject, Injectable } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { assistantMessages, assistantThreads } from "src/storage/schema";

import type { ExternalConversationInput } from "./external-conversations.schema";

@Injectable()
export class ExternalConversationsRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async append(tenantId: string, input: ExternalConversationInput) {
    return this.tenantDbRunnerService.runWithTenantTransaction(tenantId, async () => {
      const [thread] = await this.db
        .insert(assistantThreads)
        .values({
          tenantId,
          externalIntegrationId: input.integrationId,
          externalThreadKey: input.threadKey,
          source: input.source,
          title: input.title || input.messages[0].text.slice(0, 200),
          language: input.language ?? SUPPORTED_LANGUAGES.EN,
        })
        .onConflictDoUpdate({
          target: [
            assistantThreads.tenantId,
            assistantThreads.externalIntegrationId,
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
