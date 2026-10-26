import { useSyncExternalStore } from "react";

import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type { CurrentUserResponse } from "~/api/generated-api";

type AssistantActor = Pick<CurrentUserResponse["data"], "id" | "supportContext">;
export type AssistantScope = readonly ["assistant", string, string, string];

export function assistantScope(actor: AssistantActor, origin: string): AssistantScope {
  return ["assistant", origin, actor.supportContext?.targetTenantId ?? origin, actor.id];
}

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);
export function currentAssistantScope(): AssistantScope | undefined {
  const actor = queryClient.getQueryData<CurrentUserResponse | null>(["currentUser"])?.data;
  if (revoked || !actor) return;
  return assistantScope(actor, origin());
}

let generation = 0;
let revoked = false;
let currentUserFetchGeneration: number | undefined;
const listeners = new Set<() => void>();
const advance = () => {
  generation += 1;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** A validated cookie session is authoritative even if the persisted UI login flag is false. */
export function useAssistantScope() {
  const { data: actor } = useCurrentUser();
  useSyncExternalStore(
    subscribe,
    () => generation,
    () => 0,
  );
  return actor ? currentAssistantScope() : undefined;
}

useAuthStore.subscribe((state, previous) => {
  // Explicit logout also matters when the persisted flag was already false.
  if (!state.isLoggedIn) {
    revoked = true;
    advance();
  } else if (state.isLoggedIn !== previous.isLoggedIn) advance();
});
useCurrentUserStore.subscribe((state, previous) => {
  if (
    state.currentUser?.id !== previous.currentUser?.id ||
    state.currentUser?.supportContext?.targetTenantId !==
      previous.currentUser?.supportContext?.targetTenantId
  ) {
    if (!state.currentUser) revoked = true;
    advance();
  }
});
let lastIdentity = JSON.stringify(currentAssistantScope());
queryClient.getQueryCache().subscribe((event) => {
  if (event.query.queryKey.length !== 1 || event.query.queryKey[0] !== "currentUser") return;
  if (event.type === "updated") {
    if (event.action.type === "fetch") currentUserFetchGeneration = generation;
    if (event.action.type === "success") {
      const actor = (event.query.state.data as CurrentUserResponse | null)?.data;
      const validated =
        Boolean(actor) && (event.action.manual || currentUserFetchGeneration === generation);
      // A pre-logout current-user request cannot resurrect the old authenticated epoch.
      const nextRevoked = !validated;
      if (revoked !== nextRevoked) {
        revoked = nextRevoked;
        advance();
      }
    }
  }
  const identity = JSON.stringify(currentAssistantScope());
  if (identity !== lastIdentity) {
    lastIdentity = identity;
    advance();
  }
});

export class AssistantSessionChangedError extends Error {
  constructor() {
    super("Assistant session changed");
    this.name = "AssistantSessionChangedError";
  }
}

/** A logout/login cycle invalidates pending work even when the same account signs in again. */
export function captureAssistantSession(scope: AssistantScope | undefined) {
  const started = generation;
  const assertCurrent = () => {
    if (
      !scope ||
      started !== generation ||
      JSON.stringify(scope) !== JSON.stringify(currentAssistantScope())
    ) {
      throw new AssistantSessionChangedError();
    }
  };
  assertCurrent();
  return { scope: scope!, assertCurrent };
}

export async function inAssistantSession<T>(
  scope: AssistantScope | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  const session = captureAssistantSession(scope);
  try {
    const result = await operation();
    session.assertCurrent();
    return result;
  } catch (error) {
    session.assertCurrent();
    throw error;
  }
}
