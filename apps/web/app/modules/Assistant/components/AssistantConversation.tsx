import { useLocation, useNavigate } from "@remix-run/react";
import { ASSISTANT_MESSAGE_ROLES, ASSISTANT_MESSAGE_STATUSES } from "@repo/shared";
import { ChevronDown, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCancelAssistantRun } from "~/api/mutations/assistant/useCancelAssistantRun";
import { useCreateAssistantThread } from "~/api/mutations/assistant/useCreateAssistantThread";
import { useSendAssistantMessage } from "~/api/mutations/assistant/useSendAssistantMessage";
import { useAssistantAvailability } from "~/api/queries/assistant/useAssistantAvailability";
import { useAssistantMessages } from "~/api/queries/assistant/useAssistantMessages";
import { useAssistantThread } from "~/api/queries/assistant/useAssistantThread";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import ChatLoader from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatLoader";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { isAssistantRunActive, type AssistantMessage } from "../assistant.types";

import { AssistantComposer } from "./AssistantComposer";
import { AssistantEmptyState } from "./AssistantEmptyState";
import { AssistantMessageView } from "./AssistantMessageView";

type AssistantConversationProps = {
  threadId: string;
  compact?: boolean;
  initialDraft?: string;
  onDraftChange?: (draft: string) => void;
};

export function AssistantConversation({
  threadId,
  compact = false,
  initialDraft,
  onDraftChange,
}: AssistantConversationProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const language = useLanguageStore((state) => state.language);
  const state = compact
    ? null
    : (location.state as { draft?: string; clientMessageId?: string } | null);
  const [draft, setDraft] = useState(initialDraft ?? state?.draft ?? "");
  useEffect(() => {
    onDraftChange?.(draft);
  }, [draft, onDraftChange]);
  const [sendError, setSendError] = useState(Boolean(state?.draft && state.clientMessageId));
  const [pendingDraft, setPendingDraft] = useState<{
    clientMessageId: string;
    text: string;
    createdAt: string;
  } | null>(null);
  const sendInFlight = useRef(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const pendingRequest = useRef<{ text: string; id: string } | null>(
    state?.clientMessageId && state.draft
      ? { text: state.draft.trim(), id: state.clientMessageId }
      : null,
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const viewport = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const availability = useAssistantAvailability();
  const thread = useAssistantThread(threadId);
  const transcript = useAssistantMessages(threadId);
  const { mutateAsync: createThread, isPending: creating } = useCreateAssistantThread();
  const { mutateAsync: sendMessage, isPending: sending } = useSendAssistantMessage();
  const { mutateAsync: cancelRun, isPending: cancelling } = useCancelAssistantRun(threadId);
  const pages = transcript.data?.pages;
  const persistedMessages: AssistantMessage[] = pages
    ? [...pages].reverse().flatMap((page) => page.items)
    : [];
  const persistedPendingUser = Boolean(
    pendingDraft &&
      persistedMessages.some(
        (message) =>
          message.role === ASSISTANT_MESSAGE_ROLES.USER &&
          message.clientMessageId === pendingDraft.clientMessageId,
      ),
  );
  const messages: AssistantMessage[] = [...persistedMessages];
  if (pendingDraft && !persistedPendingUser) {
    messages.push({
      id: `pending-${pendingDraft.clientMessageId}`,
      threadId,
      role: ASSISTANT_MESSAGE_ROLES.USER,
      text: pendingDraft.text,
      status: ASSISTANT_MESSAGE_STATUSES.COMPLETE,
      sources: [],
      createdAt: pendingDraft.createdAt,
      clientMessageId: pendingDraft.clientMessageId,
    });
  }
  const latestRun = pages?.[0]?.latestRun ?? thread.data?.latestRun;
  const running = isAssistantRunActive(latestRun);
  const archived = thread.data?.archived === true;
  const starting = (creating || sending) && !running && !persistedPendingUser;
  const failedLoad =
    Boolean(threadId) && (thread.isError || (transcript.isError && !transcript.data));
  const loading =
    Boolean(threadId) && !transcript.data && (thread.isPending || transcript.isPending);
  const available = availability.data?.available === true;
  const lastMessage = messages[messages.length - 1];

  useEffect(() => {
    if (stickToBottom.current && viewport.current)
      viewport.current.scrollTop = viewport.current.scrollHeight;
  }, [lastMessage?.text, lastMessage?.status, messages.length, starting, latestRun?.activity]);

  const submit = async () => {
    const originalDraft = draft;
    const text = originalDraft.trim();
    if (!text || running || sending || creating || sendInFlight.current || !available || archived)
      return;
    sendInFlight.current = true;
    setSendError(false);
    const request =
      pendingRequest.current?.text === text
        ? pendingRequest.current
        : { text, id: crypto.randomUUID() };
    pendingRequest.current = request;
    setPendingDraft({ clientMessageId: request.id, text, createdAt: new Date().toISOString() });
    setDraft("");
    stickToBottom.current = true;
    let targetThreadId = threadId;
    try {
      if (!targetThreadId)
        targetThreadId = (await createThread({ title: text.slice(0, 100), language })).id;
      await sendMessage({
        threadId: targetThreadId,
        body: { text, clientMessageId: request.id, language },
      });
      if (!mounted.current) return;
      pendingRequest.current = null;
      setDraft("");
      stickToBottom.current = true;
      if (!compact && (!threadId || state?.draft))
        navigate(`/assistant/${targetThreadId}`, { replace: true, state: null });
    } catch {
      if (!mounted.current) return;
      setSendError(true);
      setPendingDraft(null);
      setDraft(originalDraft);
      if (!compact && !threadId && targetThreadId)
        navigate(`/assistant/${targetThreadId}`, {
          replace: true,
          state: { draft: originalDraft, clientMessageId: request.id },
        });
    } finally {
      sendInFlight.current = false;
    }
  };

  return (
    <>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={viewport}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
          onScroll={() => {
            const element = viewport.current;
            if (!element) return;
            const away = element.scrollHeight - element.scrollTop - element.clientHeight > 100;
            stickToBottom.current = !away;
            setShowScrollDown(away);
          }}
        >
          {loading && (
            <div
              role="status"
              className="flex flex-1 items-center justify-center gap-2 text-sm text-neutral-500 dark:text-neutral-400"
            >
              <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
              {t("assistant.loading")}
            </div>
          )}
          {failedLoad && (
            <div
              role="alert"
              className="m-auto max-w-md p-8 text-center text-sm text-neutral-600 dark:text-neutral-400"
            >
              <p>{t("assistant.threadUnavailable")}</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  void thread.refetch();
                  void transcript.refetch();
                }}
              >
                {t("assistant.retry")}
              </Button>
            </div>
          )}
          {!loading && !failedLoad && messages.length === 0 && !starting && (
            <AssistantEmptyState onSelect={setDraft} />
          )}
          {!loading && !failedLoad && (messages.length > 0 || starting) && (
            <div
              className={cn("mx-auto flex w-full flex-col", {
                "max-w-[800px] gap-6 px-6 py-7 sm:px-10": !compact,
                "gap-4 p-4": compact,
              })}
            >
              {transcript.hasNextPage && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={transcript.isFetchingNextPage}
                  onClick={() => {
                    stickToBottom.current = false;
                    void transcript.fetchNextPage();
                  }}
                >
                  {t("assistant.loadEarlier")}
                </Button>
              )}
              {messages.map((message) => (
                <AssistantMessageView
                  key={message.id}
                  message={message}
                  activity={running ? latestRun?.activity : null}
                />
              ))}
              {starting && (
                <ChatLoader
                  aiName={t("navigationSideBar.aiAssistant")}
                  status={t("assistant.activity.starting")}
                />
              )}
            </div>
          )}
        </div>
        {showScrollDown && (
          <Button
            variant="outline"
            size="icon"
            className="absolute bottom-2 right-5 size-8 rounded-lg bg-background shadow-sm"
            aria-label={t("assistant.latestMessage")}
            onClick={() => {
              if (viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight;
              stickToBottom.current = true;
              setShowScrollDown(false);
            }}
          >
            <ChevronDown className="size-4" />
          </Button>
        )}
      </div>
      {archived && (
        <p className="mx-6 rounded-lg bg-neutral-50 px-4 py-2 text-xs text-muted-foreground dark:bg-neutral-950">
          {t("assistant.archivedNotice")}
        </p>
      )}
      {!availability.isPending && !available && (
        <p role="alert" className="px-5 text-center text-xs text-neutral-600 dark:text-neutral-400">
          {t("assistant.unavailable")}
        </p>
      )}
      {sendError && (
        <p role="alert" className="px-5 text-center text-xs text-error-700">
          {t("assistant.sendError")}
        </p>
      )}
      <AssistantComposer
        compact={compact}
        value={draft}
        onChange={setDraft}
        onSend={() => {
          void submit();
        }}
        onCancel={() => {
          if (latestRun) void cancelRun(latestRun.id).catch(() => undefined);
        }}
        running={running}
        submitting={creating || sending}
        cancelling={cancelling}
        disabled={
          !available || archived || loading || failedLoad || (Boolean(threadId) && thread.isPending)
        }
      />
    </>
  );
}
