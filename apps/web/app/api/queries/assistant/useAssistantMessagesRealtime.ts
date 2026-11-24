import { ASSISTANT_SOCKET_EVENTS, type AssistantTranscriptUpdate } from "@repo/shared";
import { useEffect } from "react";

import {
  captureAssistantSession,
  useAssistantSessionGeneration,
  type AssistantScope,
} from "~/api/assistantIdentity";
import { queryClient } from "~/api/queryClient";
import { acquireSocket, releaseSocket } from "~/api/socket";

import {
  applyAssistantTranscriptUpdate,
  isNewerAssistantRun,
  type AssistantTranscriptCache,
} from "./assistantTranscriptCache";

const subscribers = new WeakMap<ReturnType<typeof acquireSocket>, Map<string, number>>();

type AssistantRealtimeOptions = {
  threadId: string;
  scope: AssistantScope | undefined;
  queryKey: readonly unknown[];
};

export function useAssistantMessagesRealtime({
  threadId,
  scope,
  queryKey,
}: AssistantRealtimeOptions) {
  const sessionGeneration = useAssistantSessionGeneration();

  useEffect(() => {
    if (!threadId || !scope) return;
    let session: ReturnType<typeof captureAssistantSession>;
    try {
      session = captureAssistantSession(scope);
    } catch {
      return;
    }
    const socket = acquireSocket();
    const payload = { threadId, userId: scope[3] };
    const subscriptionKey = `${scope[2]}:${scope[3]}:${threadId}`;
    const counts = subscribers.get(socket) ?? new Map<string, number>();
    subscribers.set(socket, counts);
    counts.set(subscriptionKey, (counts.get(subscriptionKey) ?? 0) + 1);
    let disposed = false;

    function isCurrent() {
      if (disposed) return false;
      try {
        session.assertCurrent();
        return true;
      } catch {
        return false;
      }
    }

    const reconcile = () =>
      queryClient.invalidateQueries({ queryKey, exact: true }, { cancelRefetch: false });

    const onUpdate = (update: AssistantTranscriptUpdate) => {
      if (update.threadId !== threadId || !isCurrent()) return;
      const current = queryClient.getQueryData<AssistantTranscriptCache>(queryKey);
      if (!current) {
        void reconcile();
        return;
      }
      const latestRun = current.pages[0]?.latestRun;
      const next = applyAssistantTranscriptUpdate(current, update);
      if (next !== current) queryClient.setQueryData(queryKey, next);
      // A new turn may follow an entire run missed in an earlier delivery gap.
      if (
        latestRun?.id !== update.run.id &&
        (!latestRun || isNewerAssistantRun(update.run, latestRun))
      )
        void reconcile();
    };

    const join = () => {
      if (!isCurrent()) return;
      socket
        .timeout(5000)
        .emit(
          ASSISTANT_SOCKET_EVENTS.JOIN,
          payload,
          (error: Error | null, reply?: { success: boolean }) => {
            if (!isCurrent()) {
              if (reply?.success && !counts.has(subscriptionKey) && socket.connected)
                socket.emit(ASSISTANT_SOCKET_EVENTS.LEAVE, payload);
              return;
            }
            if (!socket.connected || error || !reply?.success) return;
            // Load a snapshot after the room join to close the initial-load/reconnect race.
            const pendingFirstLoad =
              queryClient.getQueryState(queryKey)?.fetchStatus === "fetching" &&
              !queryClient.getQueryData(queryKey);
            void reconcile().then(() => {
              if (pendingFirstLoad && isCurrent() && socket.connected) void reconcile();
            });
          },
        );
    };

    socket.on(ASSISTANT_SOCKET_EVENTS.TRANSCRIPT_UPDATED, onUpdate);
    socket.on("connect", join);
    if (socket.connected) join();
    else socket.connect();

    return () => {
      disposed = true;
      socket.off(ASSISTANT_SOCKET_EVENTS.TRANSCRIPT_UPDATED, onUpdate);
      socket.off("connect", join);
      const remaining = (counts.get(subscriptionKey) ?? 1) - 1;
      if (remaining > 0) counts.set(subscriptionKey, remaining);
      else {
        counts.delete(subscriptionKey);
        if (socket.connected) socket.emit(ASSISTANT_SOCKET_EVENTS.LEAVE, payload);
      }
      releaseSocket();
    };
  }, [queryKey, scope, sessionGeneration, threadId]);
}
