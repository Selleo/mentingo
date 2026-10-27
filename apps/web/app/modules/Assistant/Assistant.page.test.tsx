import { useLocation } from "@remix-run/react";
import { createRemixStub } from "@remix-run/testing";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { assistantMessagesKey } from "~/api/queries/assistant/useAssistantMessages";
import { assistantThreadKey } from "~/api/queries/assistant/useAssistantThread";
import { queryClient } from "~/api/queryClient";
import translations from "~/locales/en/translation.json";
import { useAuthStore } from "~/modules/Auth/authStore";
import { renderWith } from "~/utils/testUtils";

import { ASSISTANT_HANDLES } from "../../../e2e/data/assistant/handles";

import AssistantPage from "./Assistant.page";
import { AssistantConversation } from "./components/AssistantConversation";
import { assistantSessionKey } from "./useAssistantSession";

const actor = vi.hoisted(() => ({
  listeners: new Set<() => void>(),
  user: {
    id: "33333333-3333-4333-8333-333333333333",
    firstName: "Alex",
    lastName: "Learner",
    profilePictureUrl: null,
    supportContext: undefined as { targetTenantId: string } | undefined,
  },
}));
vi.mock("~/api/queries", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useCurrentUserSuspense: () => {
      useSyncExternalStore(
        (listener) => {
          actor.listeners.add(listener);
          return () => {
            actor.listeners.delete(listener);
          };
        },
        () => `${actor.user.id}:${actor.user.supportContext?.targetTenantId ?? ""}`,
      );
      return { data: actor.user };
    },
  };
});

vi.mock("~/modules/Voice/hooks/useTranscription", () => ({
  useTranscription: () => ({
    isRecording: false,
    startRecording: vi.fn().mockResolvedValue(false),
    stopRecording: vi.fn().mockResolvedValue(undefined),
    cancelTranscription: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      assistantControllerGetAvailability: vi.fn(),
      assistantControllerListThreads: vi.fn(),
      assistantControllerGetThread: vi.fn(),
      assistantControllerListMessages: vi.fn(),
      assistantControllerCreateThread: vi.fn(),
      assistantControllerSendMessage: vi.fn(),
      assistantControllerUpdateThread: vi.fn(),
      assistantControllerCancelRun: vi.fn(),
    },
  },
}));
const thread = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "First conversation",
  language: "en" as const,
  archived: false,
  createdAt: "2026-10-22T10:00:00Z",
  updatedAt: "2026-10-22T10:00:00Z",
  latestRun: null,
};
const second = {
  ...thread,
  id: "22222222-2222-4222-8222-222222222222",
  title: "Second conversation",
};
const response = (data: unknown) => ({ data: { data } }) as never;
const message = (id: string, text: string, clientMessageId: string | null = null) => ({
  id,
  text,
  clientMessageId,
  threadId: thread.id,
  role: "user" as const,
  status: "complete" as const,
  sources: [],
  createdAt: thread.createdAt,
});
const sent = (clientMessageId: string, text: string) => ({
  userMessage: message("saved-user", text, clientMessageId),
  assistantMessage: {
    ...message("saved-assistant", ""),
    role: "assistant" as const,
    status: "pending" as const,
  },
  run: {
    id: "run",
    threadId: thread.id,
    status: "pending" as const,
    errorCode: null,
    activity: "starting" as const,
  },
});
const deferred = () => {
  let resolve!: (value: never) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<never>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
const renderPage = (path = `/assistant/${thread.id}`) => {
  const Page = createRemixStub([{ path: "/assistant/:threadId?", Component: AssistantPage }]);
  return renderWith().render(
    <QueryClientProvider client={queryClient}>
      <Page initialEntries={[path]} />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  window.sessionStorage.clear();
  actor.user.id = "33333333-3333-4333-8333-333333333333";
  actor.user.supportContext = undefined;
  queryClient.clear();
  useAuthStore.setState({ isLoggedIn: true });
  queryClient.setQueryData(["currentUser"], { data: actor.user });
  vi.resetAllMocks();
  vi.mocked(ApiClient.api.assistantControllerGetAvailability).mockResolvedValue(
    response({ available: true, reason: null }),
  );
  vi.mocked(ApiClient.api.assistantControllerListThreads).mockResolvedValue(
    response({ items: [thread, second], page: 1, perPage: 30, totalItems: 2 }),
  );
  vi.mocked(ApiClient.api.assistantControllerGetThread).mockImplementation(async (id) =>
    response(id === thread.id ? thread : second),
  );
  vi.mocked(ApiClient.api.assistantControllerListMessages).mockResolvedValue(
    response({ items: [], page: 1, perPage: 50, totalItems: 0, latestRun: null }),
  );
  vi.mocked(ApiClient.api.assistantControllerCreateThread).mockResolvedValue(response(thread));
});

afterEach(() => vi.restoreAllMocks());

function selectionKey() {
  return assistantSessionKey(actor.user, window.location.origin);
}

describe("AssistantPage", () => {
  it("validates and resumes the saved conversation without opening history or mounting a blank composer", async () => {
    window.sessionStorage.setItem(selectionKey(), thread.id);
    const validation = deferred();
    vi.mocked(ApiClient.api.assistantControllerGetThread).mockReturnValueOnce(validation.promise);
    renderPage("/assistant");
    expect(screen.getByRole("status")).toHaveTextContent(translations.assistant.loading);
    expect(screen.queryByTestId(ASSISTANT_HANDLES.COMPOSER)).not.toBeInTheDocument();
    expect(ApiClient.api.assistantControllerListMessages).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerGetThread).toHaveBeenCalledWith(thread.id),
    );
    await act(async () => validation.resolve(response(thread)));
    await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    expect(ApiClient.api.assistantControllerListMessages).toHaveBeenCalledWith(
      thread.id,
      expect.anything(),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(ApiClient.api.assistantControllerSendMessage).not.toHaveBeenCalled();
  });

  it("gives a direct conversation route precedence over a saved selection and remembers history navigation", async () => {
    window.sessionStorage.setItem(selectionKey(), thread.id);
    renderPage(`/assistant/${second.id}`);
    await waitFor(() => expect(window.sessionStorage.getItem(selectionKey())).toBe(second.id));
    expect(ApiClient.api.assistantControllerGetThread).not.toHaveBeenCalledWith(thread.id);
    fireEvent.click(screen.getByRole("button", { name: "Open conversation history" }));
    fireEvent.click(await screen.findByRole("link", { name: /First conversation/ }));
    await waitFor(() => expect(window.sessionStorage.getItem(selectionKey())).toBe(thread.id));
  });

  it("does not restore another user's saved conversation on the same origin", async () => {
    window.sessionStorage.setItem(selectionKey(), thread.id);
    actor.user.id = "44444444-4444-4444-8444-444444444444";
    renderPage("/assistant");
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(ApiClient.api.assistantControllerGetThread).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(selectionKey())).toBeNull();
  });

  it("ignores an old actor's pending restoration after switching accounts", async () => {
    const oldKey = selectionKey();
    window.sessionStorage.setItem(oldKey, thread.id);
    const validation = deferred();
    vi.mocked(ApiClient.api.assistantControllerGetThread).mockReturnValueOnce(validation.promise);
    renderPage("/assistant");
    await waitFor(() => expect(ApiClient.api.assistantControllerGetThread).toHaveBeenCalledOnce());
    act(() => {
      actor.user.id = "44444444-4444-4444-8444-444444444444";
      queryClient.setQueryData(["currentUser"], { data: { ...actor.user } });
      actor.listeners.forEach((listener) => listener());
    });
    await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await act(async () => validation.resolve(response(thread)));
    expect(ApiClient.api.assistantControllerListMessages).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(selectionKey())).toBeNull();
    expect(window.sessionStorage.getItem(oldKey)).toBe(thread.id);
  });

  it("revalidates a cached saved thread before navigation and discards it when the current API returns 404", async () => {
    window.sessionStorage.setItem(selectionKey(), thread.id);
    queryClient.setQueryData(assistantThreadKey(thread.id), thread);
    vi.mocked(ApiClient.api.assistantControllerGetThread).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });
    renderPage("/assistant");
    await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    expect(window.sessionStorage.getItem(selectionKey())).toBeNull();
    expect(ApiClient.api.assistantControllerListMessages).not.toHaveBeenCalled();
  });

  it("isolates support tenant selections even for the same user and origin", async () => {
    actor.user.supportContext = { targetTenantId: "tenant-a" };
    window.sessionStorage.setItem(selectionKey(), thread.id);
    actor.user.supportContext = { targetTenantId: "tenant-b" };
    renderPage("/assistant");
    await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    expect(ApiClient.api.assistantControllerGetThread).not.toHaveBeenCalled();
    expect(assistantSessionKey(actor.user, "https://other-tenant.example")).not.toBe(
      selectionKey(),
    );
  });

  it.each([403, 404, "archived"])(
    "clears an invalid saved selection (%s) and opens a new conversation",
    async (status) => {
      const key = selectionKey();
      window.sessionStorage.setItem(key, thread.id);
      if (status === "archived") {
        vi.mocked(ApiClient.api.assistantControllerGetThread).mockResolvedValue(
          response({ ...thread, archived: true }),
        );
      } else {
        vi.mocked(ApiClient.api.assistantControllerGetThread).mockRejectedValue({
          isAxiosError: true,
          response: { status },
        });
      }
      renderPage("/assistant");
      await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
      expect(window.sessionStorage.getItem(key)).toBeNull();
      expect(ApiClient.api.assistantControllerListMessages).not.toHaveBeenCalled();
      expect(ApiClient.api.assistantControllerSendMessage).not.toHaveBeenCalled();
    },
  );

  it("retains a saved selection after a transient failure and restores it only after Retry succeeds", async () => {
    const key = selectionKey();
    window.sessionStorage.setItem(key, thread.id);
    vi.mocked(ApiClient.api.assistantControllerGetThread).mockRejectedValueOnce(
      new Error("offline"),
    );
    renderPage("/assistant");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      translations.assistant.threadUnavailable,
    );
    expect(window.sessionStorage.getItem(key)).toBe(thread.id);
    expect(screen.queryByTestId(ASSISTANT_HANDLES.COMPOSER)).not.toBeInTheDocument();
    expect(ApiClient.api.assistantControllerGetThread).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: translations.assistant.retry }));
    await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    expect(ApiClient.api.assistantControllerListMessages).toHaveBeenCalledWith(
      thread.id,
      expect.anything(),
    );
    expect(ApiClient.api.assistantControllerSendMessage).not.toHaveBeenCalled();
  });

  it("New conversation overrides an in-flight restore and resets a draft even when already on the blank route", async () => {
    const key = selectionKey();
    window.sessionStorage.setItem(key, thread.id);
    const validation = deferred();
    vi.mocked(ApiClient.api.assistantControllerGetThread).mockReturnValueOnce(validation.promise);
    renderPage("/assistant");
    await waitFor(() => expect(ApiClient.api.assistantControllerGetThread).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.NEW_THREAD));
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(window.sessionStorage.getItem(key)).toBeNull();
    fireEvent.change(input, { target: { value: "Discard this unsent draft" } });
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.NEW_THREAD));
    expect(await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER)).toHaveValue("");
    await act(async () => validation.resolve(response(thread)));
    expect(ApiClient.api.assistantControllerListMessages).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(key)).toBeNull();
  });

  it("New conversation clears the current selection without immediately saving or restoring it again", async () => {
    renderPage();
    await waitFor(() => expect(window.sessionStorage.getItem(selectionKey())).toBe(thread.id));
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.NEW_THREAD));
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(window.sessionStorage.getItem(selectionKey())).toBeNull();
    expect(input).toHaveValue("");
  });

  it("starts a conversation gracefully when browser session storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderPage("/assistant");
    await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.NEW_THREAD));
    expect(screen.getByTestId(ASSISTANT_HANDLES.COMPOSER)).toHaveValue("");
    expect(ApiClient.api.assistantControllerGetThread).not.toHaveBeenCalled();
  });

  it("keeps a directly opened archived conversation out of the remembered selection", async () => {
    window.sessionStorage.setItem(selectionKey(), thread.id);
    vi.mocked(ApiClient.api.assistantControllerGetThread).mockResolvedValue(
      response({ ...thread, archived: true }),
    );
    renderPage();
    await waitFor(() => expect(window.sessionStorage.getItem(selectionKey())).toBeNull());
    expect(await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER)).toBeDisabled();
  });

  it("keeps explicit conversations usable if saving session selection exceeds storage quota", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    renderPage();
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the user message before the starting indicator while thread creation is pending", async () => {
    const creation = deferred();
    vi.mocked(ApiClient.api.assistantControllerCreateThread).mockReturnValue(creation.promise);
    renderPage("/assistant");
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: "An immediate user message" } });
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    const userMessage = await screen.findByText("An immediate user message");
    const starting = screen.getByRole("status");
    expect(
      userMessage.compareDocumentPosition(starting) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(starting).toHaveTextContent(translations.assistant.activity.starting);
    expect(input).toHaveValue("");
    expect(ApiClient.api.assistantControllerSendMessage).not.toHaveBeenCalled();
  });

  it("replaces the optimistic user by exact client ID before HTTP completion without confusing identical older text", async () => {
    const pending = deferred();
    const text = "Repeat this question";
    const old = message("old-user", text, "old-client-id");
    let page = {
      items: [old] as object[],
      page: 1,
      perPage: 50,
      totalItems: 1,
      latestRun: null as object | null,
    };
    vi.mocked(ApiClient.api.assistantControllerListMessages).mockImplementation(async () =>
      response(page),
    );
    vi.mocked(ApiClient.api.assistantControllerSendMessage).mockReturnValue(pending.promise);
    renderPage();
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: text } });
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerSendMessage).toHaveBeenCalledOnce(),
    );
    expect(screen.getAllByText(text)).toHaveLength(2);
    const body = vi.mocked(ApiClient.api.assistantControllerSendMessage).mock.calls[0][1];
    const result = sent(body.clientMessageId, text);
    // A background query may see the saved pair while the send HTTP request is still pending.
    page = {
      items: [old, result.userMessage, result.assistantMessage],
      page: 1,
      perPage: 50,
      totalItems: 3,
      latestRun: null,
    };
    act(() => {
      queryClient.setQueryData(assistantMessagesKey(thread.id), { pages: [page], pageParams: [1] });
    });
    await waitFor(() => expect(screen.getAllByTestId(ASSISTANT_HANDLES.MESSAGE)).toHaveLength(3));
    expect(screen.getAllByText(text)).toHaveLength(2);
    expect(screen.getAllByRole("status")).toHaveLength(1);
    // The eventual HTTP response must not replace newer streamed content already in the cache.
    page = {
      ...page,
      items: [
        old,
        result.userMessage,
        { ...result.assistantMessage, text: "A newer partial answer", status: "running" },
      ],
      latestRun: { ...result.run, status: "running" },
    };
    act(() => {
      queryClient.setQueryData(assistantMessagesKey(thread.id), { pages: [page], pageParams: [1] });
    });
    await act(async () => pending.resolve(response(result)));
    expect(await screen.findByText("A newer partial answer")).toBeInTheDocument();
    expect(screen.getAllByText(text)).toHaveLength(2);
    expect(screen.getAllByTestId(ASSISTANT_HANDLES.MESSAGE)).toHaveLength(3);
  });

  it("restores a rejected draft and removes its optimistic bubble while reusing the request ID", async () => {
    const first = deferred();
    const retry = deferred();
    vi.mocked(ApiClient.api.assistantControllerSendMessage)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(retry.promise);
    renderPage();
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: "  Keep the original draft  " } });
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    expect(await screen.findByText("Keep the original draft")).toBeInTheDocument();
    expect(input).toHaveValue("");
    await act(async () => first.reject(new Error("network")));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTestId(ASSISTANT_HANDLES.MESSAGE)).not.toBeInTheDocument();
    expect(input).toHaveValue("  Keep the original draft  ");
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerSendMessage).toHaveBeenCalledTimes(2),
    );
    const calls = vi.mocked(ApiClient.api.assistantControllerSendMessage).mock.calls;
    expect(calls[1][1].clientMessageId).toBe(calls[0][1].clientMessageId);
    expect(screen.getAllByText("Keep the original draft")).toHaveLength(1);
  });

  it("carries a failed new-thread draft and request ID into the created thread for retry", async () => {
    const failed = deferred();
    const retry = deferred();
    vi.mocked(ApiClient.api.assistantControllerSendMessage)
      .mockReturnValueOnce(failed.promise)
      .mockReturnValueOnce(retry.promise);
    renderPage("/assistant");
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: "  Retry in the saved thread  " } });
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerSendMessage).toHaveBeenCalledOnce(),
    );
    const firstRequest = vi.mocked(ApiClient.api.assistantControllerSendMessage).mock.calls[0];
    await act(async () => failed.reject(new Error("network")));
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerGetThread).toHaveBeenCalledWith(thread.id),
    );
    const restored = screen.getByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(restored).not.toBeDisabled());
    expect(restored).toHaveValue("  Retry in the saved thread  ");
    expect(screen.getByRole("alert")).toHaveTextContent(translations.assistant.sendError);
    expect(screen.queryByTestId(ASSISTANT_HANDLES.MESSAGE)).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerSendMessage).toHaveBeenCalledTimes(2),
    );
    expect(ApiClient.api.assistantControllerCreateThread).toHaveBeenCalledOnce();
    const secondRequest = vi.mocked(ApiClient.api.assistantControllerSendMessage).mock.calls[1];
    expect(secondRequest[0]).toBe(thread.id);
    expect(secondRequest[1].clientMessageId).toBe(firstRequest[1].clientMessageId);
  });

  it("keeps the saved first pair visible during new-thread navigation while metadata refetches", async () => {
    const pending = deferred();
    const metadata = deferred();
    const transcript = deferred();
    vi.mocked(ApiClient.api.assistantControllerGetThread).mockReturnValue(metadata.promise);
    vi.mocked(ApiClient.api.assistantControllerListMessages).mockReturnValue(transcript.promise);
    vi.mocked(ApiClient.api.assistantControllerSendMessage).mockReturnValue(pending.promise);
    renderPage("/assistant");
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: "First saved message" } });
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerSendMessage).toHaveBeenCalledOnce(),
    );
    const body = vi.mocked(ApiClient.api.assistantControllerSendMessage).mock.calls[0][1];
    await act(async () => pending.resolve(response(sent(body.clientMessageId, body.text))));
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerGetThread).toHaveBeenCalledWith(thread.id),
    );
    expect(screen.getAllByText("First saved message")).toHaveLength(1);
    expect(screen.getAllByTestId(ASSISTANT_HANDLES.MESSAGE)).toHaveLength(2);
    expect(screen.queryByText(translations.assistant.loading)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(translations.assistant.activity.starting);
  });

  it("preserves a failed draft and retries with the same idempotency key", async () => {
    vi.mocked(ApiClient.api.assistantControllerSendMessage)
      .mockRejectedValueOnce(new Error("network"))
      .mockImplementation(async (_id, body) => {
        const result = sent(body.clientMessageId, body.text);
        vi.mocked(ApiClient.api.assistantControllerListMessages).mockResolvedValue(
          response({
            items: [result.userMessage, result.assistantMessage],
            page: 1,
            perPage: 50,
            totalItems: 2,
            latestRun: result.run,
          }),
        );
        return response(result);
      });
    renderPage();
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: "Find feedback courses" } });
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    await screen.findByRole("alert");
    expect(input).toHaveValue("Find feedback courses");
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerSendMessage).toHaveBeenCalledTimes(2),
    );
    const calls = vi.mocked(ApiClient.api.assistantControllerSendMessage).mock.calls;
    expect(calls[0][1].clientMessageId).toBe(calls[1][1].clientMessageId);
    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("does not move the user back when an earlier send finishes after switching threads", async () => {
    let finish!: (value: never) => void;
    vi.mocked(ApiClient.api.assistantControllerSendMessage).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderPage("/assistant");
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: "Find courses" } });
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    await waitFor(() => expect(ApiClient.api.assistantControllerSendMessage).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveTextContent(translations.assistant.activity.starting);
    fireEvent.click(screen.getByRole("button", { name: "Open conversation history" }));
    fireEvent.click(await screen.findByRole("link", { name: /Second conversation/ }));
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerGetThread).toHaveBeenCalledWith(second.id),
    );
    finish(response(sent("switched-request", "Find courses")));
    await waitFor(() => expect(screen.getByTestId(ASSISTANT_HANDLES.COMPOSER)).toHaveValue(""));
    fireEvent.click(screen.getByRole("button", { name: "Open conversation history" }));
    expect(await screen.findByRole("link", { name: /Second conversation/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("switches active and archived history without a duplicate new-conversation action", async () => {
    renderPage("/assistant");
    fireEvent.click(await screen.findByRole("button", { name: "Open conversation history" }));
    const history = await screen.findByRole("dialog");
    expect(
      within(history).queryByRole("link", { name: "New conversation" }),
    ).not.toBeInTheDocument();
    const archivedTab = within(history).getByRole("tab", { name: "Archived" });
    fireEvent.mouseDown(archivedTab, { button: 0, ctrlKey: false });
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerListThreads).toHaveBeenLastCalledWith(
        expect.objectContaining({ archived: true }),
      ),
    );
    expect(archivedTab).toHaveAttribute("aria-selected", "true");
    fireEvent.mouseDown(within(history).getByRole("tab", { name: "Active" }), {
      button: 0,
      ctrlKey: false,
    });
    await waitFor(() =>
      expect(within(history).getByRole("tab", { name: "Active" })).toHaveAttribute(
        "aria-selected",
        "true",
      ),
    );
  });

  it("disables sending when the runtime is unavailable", async () => {
    vi.mocked(ApiClient.api.assistantControllerGetAvailability).mockResolvedValue(
      response({ available: false, reason: "WORKFLOW_UNAVAILABLE" }),
    );
    renderPage("/assistant");
    await screen.findByRole("alert");
    expect(screen.getByTestId(ASSISTANT_HANDLES.COMPOSER)).toBeDisabled();
    expect(ApiClient.api.assistantControllerCreateThread).not.toHaveBeenCalled();
  });
});

describe("shared compact Assistant conversation", () => {
  const renderCompact = (initialDraft?: string, onDraftChange = vi.fn()) => {
    const Location = () => {
      const location = useLocation();
      return (
        <output data-testid="compact-location">
          {location.pathname}
          {location.search}
        </output>
      );
    };
    const Page = createRemixStub([
      {
        path: "*",
        Component: () => (
          <>
            <Location />
            <AssistantConversation
              threadId={thread.id}
              compact
              initialDraft={initialDraft}
              onDraftChange={onDraftChange}
            />
          </>
        ),
      },
    ]);
    return renderWith().render(
      <QueryClientProvider client={queryClient}>
        <Page
          initialEntries={[
            {
              pathname: "/courses",
              search: "?category=safety",
              state: { draft: "Unrelated course form", clientMessageId: "unrelated-request" },
            },
          ]}
        />
      </QueryClientProvider>,
    );
  };

  it("ignores the caller page's route state and reports only its own initial draft and edits", async () => {
    const onDraftChange = vi.fn();
    renderCompact(undefined, onDraftChange);
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(input).toHaveValue("");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onDraftChange).toHaveBeenLastCalledWith("");
    fireEvent.change(input, { target: { value: "A compact-only draft" } });
    await waitFor(() => expect(onDraftChange).toHaveBeenLastCalledWith("A compact-only draft"));
    expect(ApiClient.api.assistantControllerSendMessage).not.toHaveBeenCalled();
  });

  it("uses an explicit mini draft and keeps the caller route intact after sending", async () => {
    const onDraftChange = vi.fn();
    vi.mocked(ApiClient.api.assistantControllerSendMessage).mockImplementation(
      async (_id, body) => {
        const result = sent(body.clientMessageId, body.text);
        vi.mocked(ApiClient.api.assistantControllerListMessages).mockResolvedValue(
          response({
            items: [result.userMessage, result.assistantMessage],
            page: 1,
            perPage: 50,
            totalItems: 2,
            latestRun: result.run,
          }),
        );
        return response(result);
      },
    );
    renderCompact("Carry this mini draft", onDraftChange);
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    expect(input).toHaveValue("Carry this mini draft");
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerSendMessage).toHaveBeenCalledOnce(),
    );
    expect(await screen.findByText("Carry this mini draft")).toBeInTheDocument();
    expect(screen.getByTestId("compact-location")).toHaveTextContent("/courses?category=safety");
    expect(input).toHaveValue("");
    expect(onDraftChange).toHaveBeenLastCalledWith("");
  });

  it("restores a failed compact draft and reuses its request ID without navigating", async () => {
    const retry = deferred();
    const onDraftChange = vi.fn();
    vi.mocked(ApiClient.api.assistantControllerSendMessage)
      .mockRejectedValueOnce(new Error("offline"))
      .mockReturnValueOnce(retry.promise);
    renderCompact("Retry this mini draft", onDraftChange);
    const input = await screen.findByTestId(ASSISTANT_HANDLES.COMPOSER);
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    await screen.findByRole("alert");
    expect(input).toHaveValue("Retry this mini draft");
    expect(onDraftChange).toHaveBeenLastCalledWith("Retry this mini draft");
    expect(screen.getByTestId("compact-location")).toHaveTextContent("/courses?category=safety");
    fireEvent.click(screen.getByTestId(ASSISTANT_HANDLES.SEND));
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerSendMessage).toHaveBeenCalledTimes(2),
    );
    const calls = vi.mocked(ApiClient.api.assistantControllerSendMessage).mock.calls;
    expect(calls[0][1].clientMessageId).toBe(calls[1][1].clientMessageId);
  });

  it("keeps the normal run-stop action in compact mode without leaving the caller route", async () => {
    const result = sent("active-request", "Saved question");
    vi.mocked(ApiClient.api.assistantControllerListMessages).mockResolvedValue(
      response({
        items: [result.userMessage, result.assistantMessage],
        page: 1,
        perPage: 50,
        totalItems: 2,
        latestRun: result.run,
      }),
    );
    vi.mocked(ApiClient.api.assistantControllerCancelRun).mockResolvedValue(
      response({ ...result.run, status: "cancelled" }),
    );
    renderCompact();
    const cancel = await screen.findByTestId(ASSISTANT_HANDLES.CANCEL);
    fireEvent.click(cancel);
    await waitFor(() =>
      expect(ApiClient.api.assistantControllerCancelRun).toHaveBeenCalledWith(
        thread.id,
        result.run.id,
      ),
    );
    expect(screen.getByTestId("compact-location")).toHaveTextContent("/courses?category=safety");
    expect(ApiClient.api.assistantControllerCreateThread).not.toHaveBeenCalled();
  });
});
