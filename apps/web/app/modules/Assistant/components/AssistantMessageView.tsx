import {
  ASSISTANT_MESSAGE_ROLES,
  ASSISTANT_MESSAGE_STATUSES,
  ASSISTANT_RUN_ACTIVITIES,
} from "@repo/shared";
import { Copy, Check, LoaderCircle } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Button } from "~/components/ui/button";
import ChatLoader from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatLoader";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";

import { ASSISTANT_HANDLES } from "../../../../e2e/data/assistant/handles";

import { AssistantSourceLink } from "./AssistantSourceLink";

import type { AssistantMessage, AssistantRun, AssistantSource } from "../assistant.types";

const SourcesContext = createContext<Map<string, AssistantSource>>(new Map());

function VerifiedMarkdownLink({ href, children }: { href?: string; children?: ReactNode }) {
  const source = useContext(SourcesContext).get(href ?? "");
  return source ? (
    <AssistantSourceLink source={source}>{children}</AssistantSourceLink>
  ) : (
    <span>{children}</span>
  );
}

// Stable renderer identities preserve an open preview during polling and streaming updates.
const markdownComponents = {
  a: VerifiedMarkdownLink,
  img: ({ alt }: { alt?: string }) => <span>{alt}</span>,
};

export function AssistantMessageView({
  message,
  activity,
}: {
  message: AssistantMessage;
  activity?: AssistantRun["activity"];
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const isUser = message.role === ASSISTANT_MESSAGE_ROLES.USER;
  const running =
    message.status === ASSISTANT_MESSAGE_STATUSES.PENDING ||
    message.status === ASSISTANT_MESSAGE_STATUSES.RUNNING;
  const phase =
    activity ??
    (message.status === ASSISTANT_MESSAGE_STATUSES.PENDING
      ? ASSISTANT_RUN_ACTIVITIES.STARTING
      : ASSISTANT_RUN_ACTIVITIES.THINKING);
  const progressLabel = t(`assistant.activity.${phase}`);
  const sources = message.sources.filter((source) => {
    if (source.url.includes("\\") || source.url.startsWith("//")) return false;
    try {
      const url = new URL(source.url, "https://assistant.invalid");
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        (/^https?:\/\//i.test(source.url) || source.url.startsWith("/"))
      );
    } catch {
      return false;
    }
  });
  const sourcesByUrl = new Map(sources.map((source) => [source.url, source]));

  if (!isUser && running && !message.text) {
    return (
      <div data-testid={ASSISTANT_HANDLES.MESSAGE}>
        <ChatLoader aiName={t("navigationSideBar.aiAssistant")} status={progressLabel} />
      </div>
    );
  }

  return (
    <ChatMessage
      id={message.id}
      role={message.role}
      aiName={t("navigationSideBar.aiAssistant")}
      content={isUser ? message.text : undefined}
      testId={ASSISTANT_HANDLES.MESSAGE}
      messageMaxWidthClass="max-w-[calc(100%-3.25rem)] sm:max-w-[82%]"
      contentNode={
        isUser ? undefined : (
          <div className="min-w-0">
            {message.text && (
              <div className="prose prose-sm max-w-none break-words text-sm text-foreground prose-headings:font-semibold prose-headings:text-foreground prose-p:leading-6 prose-a:text-primary-700 dark:prose-a:text-primary-300 prose-pre:overflow-x-auto prose-pre:bg-neutral-100 dark:prose-pre:bg-neutral-800 prose-pre:text-foreground">
                <SourcesContext.Provider value={sourcesByUrl}>
                  <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {message.text}
                  </Markdown>
                </SourcesContext.Provider>
              </div>
            )}
            {running && (
              <p
                role="status"
                className="mt-3 flex items-center gap-2 text-sm leading-6 text-neutral-800 dark:text-neutral-300"
              >
                <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
                {progressLabel}
              </p>
            )}
            {(message.status === ASSISTANT_MESSAGE_STATUSES.FAILED ||
              message.status === ASSISTANT_MESSAGE_STATUSES.CANCELLED) && (
              <p
                role="status"
                className="mt-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-400"
              >
                {t(`assistant.${message.status}`)}
              </p>
            )}
            {message.text && !running && (
              <Button
                variant="ghost"
                size="xs"
                className="mt-3 gap-1.5 text-neutral-500 dark:text-neutral-400"
                aria-label={t("assistant.copy")}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(message.text);
                    setCopied(true);
                    timer.current = setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                <span className="text-xs">{t(copied ? "assistant.copied" : "assistant.copy")}</span>
              </Button>
            )}
          </div>
        )
      }
    />
  );
}
