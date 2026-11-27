import {
  ASSISTANT_MESSAGE_ROLES,
  ASSISTANT_MESSAGE_STATUSES,
  ASSISTANT_RUN_STATUSES,
} from "@repo/shared";

import { isAssistantRunActive } from "~/modules/Assistant/assistant.types";

import type { AssistantTranscriptUpdate } from "@repo/shared";
import type { InfiniteData } from "@tanstack/react-query";
import type { ApiClient } from "~/api/api-client";

type Response = Awaited<ReturnType<typeof ApiClient.api.assistantControllerListMessages>>;

export type AssistantMessagePage = Response["data"]["data"];
export type AssistantTranscriptCache = InfiniteData<AssistantMessagePage, number>;

type Message = AssistantMessagePage["items"][number];
type Run = NonNullable<AssistantMessagePage["latestRun"]>;

/** PostgreSQL emits a space and a short timezone offset, which Safari does not parse as ISO. */
function readAssistantTimestamp(value: string) {
  return Date.parse(
    value
      .replace(" ", "T")
      .replace(
        /([+-]\d{2})(?::?(\d{2}))?$/,
        (_offset, hours, minutes) => `${hours}:${minutes ?? "00"}`,
      ),
  );
}

function compareDates(first: string, second: string) {
  return readAssistantTimestamp(first) - readAssistantTimestamp(second);
}

function compareRuns(first: Run, second: Run) {
  if (first.id !== second.id)
    return compareDates(first.createdAt, second.createdAt) || first.id.localeCompare(second.id);
  if (isAssistantRunActive(first) !== isAssistantRunActive(second))
    return isAssistantRunActive(first) ? -1 : 1;
  return compareDates(first.updatedAt, second.updatedAt);
}

export function isNewerAssistantRun(candidate: Run, current: Run) {
  return compareRuns(candidate, current) > 0;
}

function compareMessages(first: Message, second: Message) {
  const byDate = compareDates(first.createdAt, second.createdAt);
  if (byDate) return byDate;
  if (first.role === second.role) return first.id.localeCompare(second.id);
  return first.role === ASSISTANT_MESSAGE_ROLES.USER ? -1 : 1;
}

/** A checkpoint contains the whole saved reply, so later checkpoints supersede missed partial text. */
export function applyAssistantTranscriptUpdate(
  cache: AssistantTranscriptCache,
  update: AssistantTranscriptUpdate,
): AssistantTranscriptCache {
  const first = cache.pages[0];
  if (!first || (first.latestRun && compareRuns(update.run, first.latestRun) < 0)) return cache;

  const updates = update.userMessage
    ? [update.userMessage, update.assistantMessage]
    : [update.assistantMessage];
  const loaded = cache.pages.flatMap((page) => page.items);
  const loadedById = new Map(loaded.map((message) => [message.id, message]));
  // A new run without its initial send event needs a snapshot to restore the user message.
  if (
    !update.userMessage &&
    first.latestRun?.id !== update.run.id &&
    !loadedById.has(update.assistantMessage.id)
  )
    return cache;

  const additions = updates.filter((message) => !loadedById.has(message.id));
  const replacements = new Map<string, Message>();
  for (const message of updates) {
    const previous = loadedById.get(message.id);
    if (previous && compareDates(message.updatedAt, previous.updatedAt) > 0)
      replacements.set(message.id, message);
  }
  if (additions.length === 0) {
    if (!replacements.size && first.latestRun && compareRuns(update.run, first.latestRun) === 0)
      return cache;
    const replace = (message: Message) => replacements.get(message.id) ?? message;
    return {
      ...cache,
      pages: cache.pages.map((page, index) =>
        index === 0 || page.items.some((message) => replacements.has(message.id))
          ? { ...page, items: page.items.map(replace), latestRun: update.run }
          : page,
      ),
    };
  }

  const updatedMessages = [
    ...loaded.map((message) => replacements.get(message.id) ?? message),
    ...additions,
  ];
  const newestFirst = updatedMessages.sort(compareMessages).reverse();
  return {
    ...cache,
    pages: cache.pages.map((page, index) => ({
      ...page,
      items: newestFirst.slice(index * page.perPage, (index + 1) * page.perPage).reverse(),
      totalItems: first.totalItems + additions.length,
      latestRun: update.run,
    })),
  };
}

/** An HTTP refresh may have started before a realtime checkpoint arrived. */
export function keepNewerAssistantTranscript(previous: unknown, incoming: unknown) {
  const current = previous as AssistantTranscriptCache | undefined;
  const next = incoming as AssistantTranscriptCache;
  const currentRun = current?.pages[0]?.latestRun;
  const nextRun = next.pages[0]?.latestRun;
  if (!current || !currentRun) return next;
  if (nextRun && compareRuns(currentRun, nextRun) <= 0) return next;
  if (next.pages.length <= current.pages.length) return current;
  // Keep the newer checkpoint but still show older pages loaded while it arrived.
  const loadedIds = new Set(current.pages.flatMap((page) => page.items.map(({ id }) => id)));
  const olderPages = next.pages.slice(current.pages.length).map((page) => ({
    ...page,
    items: page.items.filter(({ id }) => !loadedIds.has(id)),
    totalItems: current.pages[0]?.totalItems ?? page.totalItems,
    latestRun: currentRun,
  }));
  return {
    pages: [...current.pages, ...olderPages],
    pageParams: [...current.pageParams, ...next.pageParams.slice(current.pageParams.length)],
  };
}

/** Realtime events are best-effort, so an active run is periodically reconciled over HTTP. */
export const ACTIVE_RUN_REFRESH_MS = 15_000;

export function assistantTranscriptRefetchInterval(cache: AssistantTranscriptCache | undefined) {
  return isAssistantRunActive(cache?.pages[0]?.latestRun) ? ACTIVE_RUN_REFRESH_MS : false;
}

export function settledAssistantMessages(messages: Message[], run: Run | null | undefined) {
  const active = isAssistantRunActive(run);
  const lastMessageId = messages.at(-1)?.id;
  return messages.map((message) => {
    const unsettled =
      message.role === ASSISTANT_MESSAGE_ROLES.ASSISTANT &&
      (message.status === ASSISTANT_MESSAGE_STATUSES.PENDING ||
        message.status === ASSISTANT_MESSAGE_STATUSES.RUNNING);
    if (!unsettled || (active && message.id === lastMessageId)) return message;
    if (message.id === lastMessageId && run?.status === ASSISTANT_RUN_STATUSES.CANCELLED)
      return { ...message, status: ASSISTANT_MESSAGE_STATUSES.CANCELLED };
    if (
      message.id === lastMessageId &&
      run?.status === ASSISTANT_RUN_STATUSES.COMPLETED &&
      message.text
    )
      return { ...message, status: ASSISTANT_MESSAGE_STATUSES.COMPLETE };
    return { ...message, status: ASSISTANT_MESSAGE_STATUSES.FAILED };
  });
}
