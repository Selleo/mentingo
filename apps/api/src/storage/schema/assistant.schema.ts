import {
  SUPPORTED_LANGUAGES,
  AI_CONVERSATION_SOURCES,
  type AiConversationSource,
  ASSISTANT_MESSAGE_STATUSES,
  ASSISTANT_RUN_STATUSES,
  type AssistantRunStatus,
  type AssistantMessageStatus,
  type SupportedLanguages,
  type AssistantRunActivity,
  type AssistantMessageRole,
  type AssistantSourceType,
} from "@repo/shared";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { id, tenantId, timestamps, withTenantIdIndex } from "./utils";

import { users } from ".";

export type AssistantSource = {
  title: string;
  url: string;
  entityType?: AssistantSourceType;
  description?: string;
};

export const assistantThreads = pgTable(
  "assistant_threads",
  {
    ...id,
    ...timestamps,
    tenantId,
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    language: text("language")
      .$type<SupportedLanguages>()
      .notNull()
      .default(SUPPORTED_LANGUAGES.EN),
    source: text("source").$type<AiConversationSource>().notNull().default(AI_CONVERSATION_SOURCES.MENTINGO),
    externalThreadKey: text("external_thread_key"),
    externalIntegrationId: text("external_integration_id"),
    archived: boolean("archived").notNull().default(false),
  },
  withTenantIdIndex("assistant_threads", (table) => ({
    externalThreadUnique: uniqueIndex("assistant_threads_external_unique").on(
      table.tenantId,
      table.externalIntegrationId,
      table.source,
      table.externalThreadKey,
    ),
    ownerUpdatedIdx: index("assistant_threads_owner_updated_idx").on(
      table.tenantId,
      table.userId,
      table.updatedAt,
    ),
  })),
);

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    ...id,
    ...timestamps,
    tenantId,
    threadId: uuid("thread_id")
      .references(() => assistantThreads.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").$type<AssistantMessageRole>().notNull(),
    text: text("text").notNull().default(""),
    status: text("status")
      .$type<AssistantMessageStatus>()
      .notNull()
      .default(ASSISTANT_MESSAGE_STATUSES.COMPLETE),
    sources: jsonb("sources").$type<AssistantSource[]>().notNull().default([]),
    externalMessageId: text("external_message_id"),
    externalUserId: text("external_user_id"),
    externalUserName: text("external_user_name"),
    clientMessageId: uuid("client_message_id"),
  },
  withTenantIdIndex("assistant_messages", (table) => ({
    threadCreatedIdx: index("assistant_messages_thread_created_idx").on(
      table.tenantId,
      table.threadId,
      table.createdAt,
      table.id,
    ),
    externalMessageUnique: uniqueIndex("assistant_messages_external_unique").on(
      table.tenantId,
      table.threadId,
      table.externalMessageId,
    ),
    clientIdUnique: uniqueIndex("assistant_messages_client_id_unique").on(
      table.tenantId,
      table.threadId,
      table.clientMessageId,
    ),
  })),
);

export const assistantRuns = pgTable(
  "assistant_runs",
  {
    ...id,
    ...timestamps,
    tenantId,
    threadId: uuid("thread_id")
      .references(() => assistantThreads.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    userMessageId: uuid("user_message_id")
      .references(() => assistantMessages.id, { onDelete: "cascade" })
      .notNull(),
    assistantMessageId: uuid("assistant_message_id")
      .references(() => assistantMessages.id, { onDelete: "cascade" })
      .notNull(),
    language: text("language").$type<SupportedLanguages>().notNull(),
    origin: text("origin").notNull(),
    status: text("status")
      .$type<AssistantRunStatus>()
      .notNull()
      .default(ASSISTANT_RUN_STATUSES.PENDING),
    activity: text("activity").$type<AssistantRunActivity>(),
    workflowRunId: text("workflow_run_id"),
    errorCode: text("error_code"),
    successfulToolCalls: integer("successful_tool_calls").notNull().default(0),
    readableToolCalls: integer("readable_tool_calls").notNull().default(0),
    sources: jsonb("sources").$type<AssistantSource[]>().notNull().default([]),
  },
  withTenantIdIndex("assistant_runs", (table) => ({
    threadCreatedIdx: index("assistant_runs_thread_created_idx").on(
      table.tenantId,
      table.threadId,
      table.createdAt,
    ),
    userMessageUnique: uniqueIndex("assistant_runs_user_message_unique").on(
      table.tenantId,
      table.userMessageId,
    ),
    activeThreadUnique: uniqueIndex("assistant_runs_active_thread_unique")
      .on(table.tenantId, table.threadId)
      .where(
        sql`${table.status} in (${ASSISTANT_RUN_STATUSES.PENDING}, ${ASSISTANT_RUN_STATUSES.RUNNING})`.inlineParams(),
      ),
  })),
);
