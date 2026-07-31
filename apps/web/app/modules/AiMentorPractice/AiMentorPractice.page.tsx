import { useChat, type UIMessage } from "@ai-sdk/react";
import { useNavigate, useParams } from "@remix-run/react";
import { createTextUiMessage, toUiMessageRole } from "@repo/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateAiMentorPractice } from "~/api/mutations/useCreateAiMentorPractice";
import { useRetryAiMentorPractice } from "~/api/mutations/useRetryAiMentorPractice";
import { useAiMentorPractice } from "~/api/queries/useAiMentorPractice";
import { useCurrentThreadMessages } from "~/api/queries/useCurrentThreadMessages";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import Loader from "~/modules/common/Loader/Loader";
import { createAiMentorChatTransport } from "~/modules/Courses/Lesson/AiMentorLesson/aiMentorChatTransport";
import ChatLoader from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatLoader";
import ChatMessage from "~/modules/Courses/Lesson/AiMentorLesson/components/ChatMessage";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

const fields = ["challenge", "counterpart", "desiredOutcome"] as const;

export default function AiMentorPracticePage() {
  const { t } = useTranslation();
  const { id = "new" } = useParams();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const isNew = id === "new";
  const { data: practice, isLoading, isError, refetch } = useAiMentorPractice(isNew ? "" : id);
  const { mutateAsync: createPractice, isPending: isCreating } = useCreateAiMentorPractice();
  const { mutateAsync: retryPractice, isPending: isRetrying } = useRetryAiMentorPractice();
  const [answers, setAnswers] = useState({
    challenge: "",
    counterpart: "",
    desiredOutcome: "",
  });

  const handleCreate = async () => {
    const created = await createPractice({ ...answers, language });
    navigate(`/ai-mentor/practice/${created.id}`, { replace: true });
  };

  if (isNew) {
    return (
      <PageWrapper className="mx-auto max-w-3xl">
        <h1 className="h4">{t("aiMentorPractice.form.title")}</h1>
        <p className="mt-2 text-neutral-600">{t("aiMentorPractice.form.description")}</p>
        <div className="mt-6 space-y-5">
          {fields.map((field) => (
            <label key={field} className="block">
              <span className="body-sm-md text-neutral-950">
                {t(`aiMentorPractice.form.${field}`)}
              </span>
              <Textarea
                className="mt-2"
                required
                maxLength={1000}
                value={answers[field]}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [field]: event.target.value }))
                }
              />
            </label>
          ))}
          <Button
            type="button"
            disabled={isCreating || fields.some((field) => !answers[field].trim())}
            onClick={() => void handleCreate()}
          >
            {t("aiMentorPractice.form.submit")}
          </Button>
        </div>
      </PageWrapper>
    );
  }

  if (isLoading) {
    return (
      <PageWrapper className="flex min-h-80 items-center justify-center">
        <Loader />
      </PageWrapper>
    );
  }

  if (isError || !practice) {
    return (
      <PageWrapper className="flex min-h-80 flex-col items-center justify-center gap-3">
        <p>{t("aiMentorPractice.error")}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          {t("dashboardHome.error.retry")}
        </Button>
      </PageWrapper>
    );
  }

  if (practice.status === "queued" || practice.status === "processing") {
    return (
      <PageWrapper className="flex min-h-80 flex-col items-center justify-center gap-4">
        <Loader />
        <p>{t("aiMentorPractice.generating")}</p>
      </PageWrapper>
    );
  }

  if (practice.status === "failed") {
    return (
      <PageWrapper className="flex min-h-80 flex-col items-center justify-center gap-4">
        <p>{t("aiMentorPractice.failed")}</p>
        <Button disabled={isRetrying} onClick={() => void retryPractice(practice.id)}>
          {t("aiMentorPractice.retry")}
        </Button>
      </PageWrapper>
    );
  }

  return <PracticeConversation threadId={practice.threadId ?? ""} title={practice.title} />;
}

function PracticeConversation({ threadId, title }: { threadId: string; title: string | null }) {
  const { t } = useTranslation();
  const { data: persistedMessages, isLoading } = useCurrentThreadMessages({
    isThreadLoading: !threadId,
    threadId,
  });
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const transport = useMemo(() => createAiMentorChatTransport(threadId), [threadId]);
  const { messages, setMessages, sendMessage, status } = useChat({ transport });
  const isProcessing = status === "submitted" || status === "streaming";

  useEffect(() => {
    setMessages(
      persistedMessages?.data.map((message) =>
        createTextUiMessage<UIMessage>({
          id: message.id,
          role: toUiMessageRole<UIMessage["role"]>(message.role),
          content: message.content,
        }),
      ) ?? [],
    );
  }, [persistedMessages, setMessages]);

  useEffect(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const submit = () => {
    const message = input.trim();
    if (!message) return;
    setInput("");
    void sendMessage({ text: message });
  };

  return (
    <PageWrapper className="mx-auto flex h-[calc(100vh-7rem)] max-w-4xl flex-col">
      <h1 className="h4 mb-5">{title || t("aiMentorPractice.conversationTitle")}</h1>
      <div ref={containerRef} className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {!isLoading &&
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              id={message.id}
              role={message.role}
              parts={message.parts}
              aiName={t("studentCourseView.lesson.aiMentorLesson.aiMentorName")}
            />
          ))}
        {isProcessing && <ChatLoader aiName={t("aiMentorPractice.mentorName")} />}
      </div>
      <div className="mt-4 flex gap-3">
        <Textarea
          value={input}
          aria-label={t("aiMentorPractice.message")}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <Button disabled={!input.trim() || isProcessing} onClick={submit}>
          {t("aiMentorPractice.send")}
        </Button>
      </div>
    </PageWrapper>
  );
}
