import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { useSendAssistantMessage } from "~/api/mutations/assistant/useSendAssistantMessage";
import {
  assistantMessagesKey,
  useAssistantMessages,
} from "~/api/queries/assistant/useAssistantMessages";
import { useAssistantThreads } from "~/api/queries/assistant/useAssistantThreads";
import { queryClient } from "~/api/queryClient";
import { authService } from "~/modules/Auth/authService";
import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { assistantScope, AssistantSessionChangedError } from "./assistantIdentity";

import type { ReactNode } from "react";
import type { CurrentUserResponse } from "~/api/generated-api";

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      authControllerCurrentUser: vi.fn(),
      assistantControllerListThreads: vi.fn(),
      assistantControllerListMessages: vi.fn(),
      assistantControllerSendMessage: vi.fn(),
    },
  },
}));

const actor = (id: string, tenant?: string) =>
  ({
    id,
    ...(tenant ? { supportContext: { targetTenantId: tenant } } : {}),
  }) as CurrentUserResponse["data"];
const userA = actor("user-a");
const userB = actor("user-b");
const scope = (user = userA) => assistantScope(user, window.location.origin);
const login = (user: CurrentUserResponse["data"]) => {
  queryClient.setQueryData(["currentUser"], { data: user });
  useCurrentUserStore.setState({ currentUser: user });
  useAuthStore.setState({ isLoggedIn: true });
};
const response = (data: unknown) => ({ data: { data } }) as never;
const page = (items: unknown[]) => ({
  items,
  page: 1,
  perPage: 50,
  totalItems: items.length,
  latestRun: null,
});
const deferred = () => {
  let resolve!: (value: never) => void;
  const promise = new Promise<never>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const pair = {
  userMessage: { id: "a-user", role: "user", text: "A private message" },
  assistantMessage: {
    id: "a-assistant",
    role: "assistant",
    text: "A private answer",
    status: "complete",
  },
  run: { status: "completed" },
};
const variables = {
  threadId: "shared-route",
  body: {
    text: "A private message",
    clientMessageId: "11111111-1111-4111-8111-111111111111",
    language: "en" as const,
  },
};
function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
function HistoryAndTranscript() {
  const threads = useAssistantThreads("", false);
  const messages = useAssistantMessages("shared-route");
  return (
    <>
      {threads.data?.pages
        .flatMap((entry) => entry.items)
        .map((thread) => <p key={thread.id}>{thread.title}</p>)}
      {messages.data?.pages
        .flatMap((entry) => entry.items)
        .map((message) => <p key={message.id}>{message.text}</p>)}
    </>
  );
}

beforeEach(() => {
  queryClient.clear();
  vi.resetAllMocks();
  login(userA);
  vi.mocked(ApiClient.api.assistantControllerListThreads).mockResolvedValue(response(page([])));
  vi.mocked(ApiClient.api.assistantControllerListMessages).mockResolvedValue(response(page([])));
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe("Assistant private cache isolation", () => {
  it("accepts a fresh server cookie session when the persisted login flag is false", async () => {
    authService.logout();
    queryClient.clear();
    vi.mocked(ApiClient.api.authControllerCurrentUser).mockResolvedValue({
      data: { data: userB },
    } as never);
    vi.mocked(ApiClient.api.assistantControllerListThreads).mockResolvedValue(
      response(page([{ id: "b", title: "Cookie session title" }])),
    );
    render(
      <Wrapper>
        <HistoryAndTranscript />
      </Wrapper>,
    );
    expect(await screen.findByText("Cookie session title")).toBeVisible();
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  it.each([false, true])(
    "restores a fresh cookie session without clearing cached identity (sync login flag: %s)",
    async (syncLoginFlag) => {
      act(() => useAuthStore.setState({ isLoggedIn: false }));
      const held = deferred();
      let refresh!: Promise<unknown>;
      act(() => {
        refresh = queryClient.fetchQuery({
          queryKey: ["currentUser"],
          queryFn: () => held.promise,
          staleTime: 0,
        });
      });
      render(
        <Wrapper>
          <HistoryAndTranscript />
        </Wrapper>,
      );
      if (syncLoginFlag) act(() => useAuthStore.setState({ isLoggedIn: true }));
      await act(async () => {
        held.resolve({ data: userA } as never);
        await refresh;
      });
      await waitFor(() => expect(ApiClient.api.assistantControllerListThreads).toHaveBeenCalled());
    },
  );

  it("hides cached content after logout even when the old current-user query remains cached", async () => {
    vi.mocked(ApiClient.api.assistantControllerListThreads).mockResolvedValue(
      response(page([{ id: "a", title: "A confidential title" }])),
    );
    vi.mocked(ApiClient.api.assistantControllerListMessages).mockResolvedValue(
      response(page([pair.userMessage])),
    );
    render(
      <Wrapper>
        <HistoryAndTranscript />
      </Wrapper>,
    );
    expect(await screen.findByText("A confidential title")).toBeVisible();
    expect(await screen.findByText("A private message")).toBeVisible();
    act(() => authService.logout());
    await waitFor(() => expect(screen.queryByText("A private message")).not.toBeInTheDocument());
    expect(screen.queryByText("A confidential title")).not.toBeInTheDocument();
    expect(queryClient.getQueryData(["currentUser"])).toEqual({ data: userA });
  });

  it("does not restore a revoked epoch from a current-user fetch started before logout", async () => {
    vi.mocked(ApiClient.api.assistantControllerListThreads).mockResolvedValue(
      response(page([{ id: "a", title: "A confidential title" }])),
    );
    render(
      <Wrapper>
        <HistoryAndTranscript />
      </Wrapper>,
    );
    expect(await screen.findByText("A confidential title")).toBeVisible();
    const held = deferred();
    let refresh!: Promise<unknown>;
    act(() => {
      refresh = queryClient.fetchQuery({
        queryKey: ["currentUser"],
        queryFn: () => held.promise,
        staleTime: 0,
      });
    });
    act(() => {
      authService.logout();
      queryClient.setQueryData(["currentUser"], null);
    });
    await act(async () => {
      held.resolve({ data: userA } as never);
      await refresh;
    });
    expect(screen.queryByText("A confidential title")).not.toBeInTheDocument();
    await act(async () => {
      await queryClient.fetchQuery({
        queryKey: ["currentUser"],
        queryFn: async () => ({ data: userA }),
        staleTime: 0,
      });
    });
    expect(await screen.findByText("A confidential title")).toBeVisible();
  });

  it.each([
    ["another account", userB],
    ["another support tenant", actor("user-a", "tenant-b")],
  ])("never displays cached history or transcript for %s", async (_label, nextActor) => {
    vi.mocked(ApiClient.api.assistantControllerListThreads).mockResolvedValueOnce(
      response(page([{ id: "a-thread", title: "A confidential title" }])),
    );
    vi.mocked(ApiClient.api.assistantControllerListMessages).mockResolvedValueOnce(
      response(page([pair.userMessage])),
    );
    render(
      <Wrapper>
        <HistoryAndTranscript />
      </Wrapper>,
    );
    expect(await screen.findByText("A confidential title")).toBeVisible();
    expect(await screen.findByText("A private message")).toBeVisible();
    const held = deferred();
    vi.mocked(ApiClient.api.assistantControllerListThreads).mockReturnValue(held.promise);
    vi.mocked(ApiClient.api.assistantControllerListMessages).mockReturnValue(held.promise);
    act(() => login(nextActor));
    await waitFor(() => expect(screen.queryByText("A confidential title")).not.toBeInTheDocument());
    expect(screen.queryByText("A private message")).not.toBeInTheDocument();
    await act(async () => {
      held.resolve(response(page([{ id: "b-thread", title: "B title", text: "B message" }])));
    });
    expect(await screen.findByText("B title")).toBeVisible();
    expect(screen.queryByText("A private message")).not.toBeInTheDocument();
  });

  it.each([
    ["different account", userB],
    ["same account new login", userA],
  ])(
    "rejects delayed send after logout/clear and %s without reseeding any private data",
    async (_label, nextActor) => {
      const held = deferred();
      vi.mocked(ApiClient.api.assistantControllerSendMessage).mockReturnValue(held.promise);
      const hook = renderHook(() => useSendAssistantMessage(), { wrapper: Wrapper });
      let request!: Promise<unknown>;
      act(() => {
        request = hook.result.current.mutateAsync(variables);
      });
      const rejection = expect(request).rejects.toBeInstanceOf(AssistantSessionChangedError);
      await waitFor(() =>
        expect(ApiClient.api.assistantControllerSendMessage).toHaveBeenCalledOnce(),
      );
      act(() => {
        authService.logout();
        queryClient.clear();
        login(nextActor);
      });
      await act(async () => {
        held.resolve(response(pair));
        await rejection;
      });
      expect(JSON.stringify(queryClient.getQueriesData({ queryKey: ["assistant"] }))).not.toContain(
        "A private",
      );
      expect(
        queryClient.getQueryData(assistantMessagesKey("shared-route", scope(userA))),
      ).toBeUndefined();
      render(
        <Wrapper>
          <HistoryAndTranscript />
        </Wrapper>,
      );
      await waitFor(() => expect(ApiClient.api.assistantControllerListThreads).toHaveBeenCalled());
      expect(screen.queryByText("A private message")).not.toBeInTheDocument();
      expect(screen.queryByText("A private answer")).not.toBeInTheDocument();
    },
  );

  it("keeps a delayed query response out of a superseded session", async () => {
    const held = deferred();
    vi.mocked(ApiClient.api.assistantControllerListThreads).mockReturnValueOnce(held.promise);
    render(
      <Wrapper>
        <HistoryAndTranscript />
      </Wrapper>,
    );
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerListThreads).toHaveBeenCalledOnce(),
    );
    act(() => login(userB));
    await act(async () => {
      held.resolve(response(page([{ id: "a", title: "Late A secret" }])));
    });
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerListThreads).toHaveBeenCalledTimes(2),
    );
    expect(screen.queryByText("Late A secret")).not.toBeInTheDocument();
    expect(JSON.stringify(queryClient.getQueriesData({ queryKey: ["assistant"] }))).not.toContain(
      "Late A secret",
    );
  });

  it("seeds the initial pair for a valid session and preserves a newer existing transcript", async () => {
    vi.mocked(ApiClient.api.assistantControllerSendMessage).mockResolvedValue(response(pair));
    const hook = renderHook(() => useSendAssistantMessage(), { wrapper: Wrapper });
    await act(async () => {
      await hook.result.current.mutateAsync(variables);
    });
    expect(queryClient.getQueryData(assistantMessagesKey("shared-route", scope()))).toMatchObject({
      pages: [{ items: [pair.userMessage, pair.assistantMessage] }],
    });
    const newer = {
      pages: [page([{ id: "newer", text: "Newer streaming checkpoint" }])],
      pageParams: [1],
    };
    queryClient.setQueryData(assistantMessagesKey("shared-route", scope()), newer);
    await act(async () => {
      await hook.result.current.mutateAsync(variables);
    });
    expect(queryClient.getQueryData(assistantMessagesKey("shared-route", scope()))).toEqual(newer);
  });
});
