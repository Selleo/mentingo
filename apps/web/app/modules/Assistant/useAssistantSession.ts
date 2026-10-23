import { useNavigate } from "@remix-run/react";
import { isAxiosError } from "axios";
import { useCallback, useEffect, useState } from "react";

import { useAssistantThread } from "~/api/queries/assistant/useAssistantThread";

import type { CurrentUserResponse } from "~/api/generated-api";

type SessionActor = Pick<CurrentUserResponse["data"], "id"> & {
  supportContext?: Pick<
    NonNullable<CurrentUserResponse["data"]["supportContext"]>,
    "targetTenantId"
  >;
};

/** Normal tenant identity is its origin; support sessions also expose an explicit tenant ID. */
export function assistantSessionKey(actor: SessionActor, origin: string) {
  return `mentingo:assistant:last-thread:v1:${encodeURIComponent(origin)}:${encodeURIComponent(actor.supportContext?.targetTenantId ?? origin)}:${encodeURIComponent(actor.id)}`;
}

export const ASSISTANT_SESSION_CHANGED = "mentingo:assistant-session-changed";

export function readAssistantSelection(key: string): string | null {
  try {
    const value = window.sessionStorage.getItem(key);
    if (!value) return null;
    if (/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)) return value;
    window.sessionStorage.removeItem(key);
  } catch {
    // Blocked storage must not prevent a user from starting a conversation.
  }
  return null;
}

export function writeAssistantSelection(key: string, threadId: string | null) {
  try {
    if (threadId) window.sessionStorage.setItem(key, threadId);
    else window.sessionStorage.removeItem(key);
  } catch {
    // Session persistence is optional when storage is unavailable or full.
  }
  window.dispatchEvent(new CustomEvent(ASSISTANT_SESSION_CHANGED, { detail: { key } }));
}

function isMissingThread(error: unknown) {
  return isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0);
}

/** Remembers only a scoped thread ID; content and authorization remain owned by normal API queries. */
export function useAssistantSession(key: string, threadId?: string) {
  const navigate = useNavigate();
  const [selection, setSelection] = useState<string | null>();
  const [restore, setRestore] = useState<"pending" | "failed">("pending");
  const [attempt, setAttempt] = useState(0);
  const [explicitNew, setExplicitNew] = useState(false);
  const [newConversationRevision, setNewConversationRevision] = useState(0);
  const lookup = useAssistantThread(threadId || selection || "");

  // Keep server rendering and initial hydration identical before touching browser-only storage.
  useEffect(() => {
    setSelection(readAssistantSelection(key));
  }, [key]);

  const remember = useCallback(
    (id: string | null) => {
      writeAssistantSelection(key, id);
      setSelection(id);
    },
    [key],
  );

  useEffect(() => {
    if (!threadId || explicitNew || lookup.isFetching) return;
    if ((lookup.isSuccess && lookup.data.archived) || isMissingThread(lookup.error)) {
      if (selection === threadId) remember(null);
      return;
    }
    if (
      lookup.isSuccess &&
      lookup.data.id === threadId &&
      !lookup.data.archived &&
      selection !== threadId
    ) {
      remember(threadId);
    }
  }, [
    explicitNew,
    lookup.data,
    lookup.error,
    lookup.isFetching,
    lookup.isSuccess,
    remember,
    selection,
    threadId,
  ]);

  useEffect(() => {
    if (threadId) setExplicitNew(false);
  }, [threadId]);

  const refetch = lookup.refetch;
  useEffect(() => {
    if (threadId || !selection) return;
    let active = true;
    setRestore("pending");
    // Join the normal query's fresh request, rather than trusting a cached permission decision.
    void refetch({ cancelRefetch: false })
      .then((result) => {
        if (!active) return;
        if (isMissingThread(result.error) || (result.isSuccess && result.data.archived)) {
          remember(null);
        } else if (result.isSuccess && result.data.id === selection) {
          navigate(`/assistant/${selection}`, { replace: true });
        } else {
          setRestore("failed");
        }
      })
      .catch(() => {
        if (active) setRestore("failed");
      });
    return () => {
      active = false;
    };
  }, [attempt, navigate, refetch, remember, selection, threadId]);

  const startNew = () => {
    setExplicitNew(true);
    remember(null);
    setRestore("pending");
    setNewConversationRevision((revision) => revision + 1);
  };

  return {
    isResuming:
      !threadId && (selection === undefined || (Boolean(selection) && restore === "pending")),
    resumeFailed: !threadId && Boolean(selection) && restore === "failed",
    retryResume: () => setAttempt((value) => value + 1),
    newConversationRevision,
    startNew,
  };
}
