import { useChat } from "@ai-sdk/react";
import { createTextUiMessage, toUiMessageRole } from "@repo/shared";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCourseGenerationMessages } from "~/api/queries/admin/useCourseGenerationMessages";
import { hasCourseGeneratedFlag } from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationChat.utils";
import { invalidateCourseGenerationSyncQueries } from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationSync.utils";

import type { Dispatch, SetStateAction } from "react";
import type { CourseGenerationUIMessage } from "~/modules/Admin/EditCourse/hooks/useCourseGenerationChat.types";

type UseCourseGenerationChatOptions = {
  courseId: string;
  draftId?: string;
  onInvalidate?: () => void;
};

type CourseGenerationChatStatus = "submitted" | "streaming" | "ready" | "error";

type CourseGenerationChatResult = {
  messages: CourseGenerationUIMessage[];
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  setMessages: (messages: CourseGenerationUIMessage[]) => void;
  status: CourseGenerationChatStatus;
  data: unknown[];
  handleSubmit: () => Promise<void>;
};

const apiUrl = import.meta.env.VITE_API_URL;
const chatUrl = apiUrl
  ? `${apiUrl}/api/luma/course-generation/chat`
  : "/api/luma/course-generation/chat";

const getCourseGenerationStreamData = (messages: CourseGenerationUIMessage[]) =>
  messages.flatMap((message) =>
    message.parts.flatMap((part) =>
      part.type === "data-courseGenerationEvent" ? [part.data] : [],
    ),
  );

export function useCourseGenerationChat({
  courseId,
  draftId,
  onInvalidate,
}: UseCourseGenerationChatOptions): CourseGenerationChatResult {
  const [input, setInput] = useState("");
  const onInvalidateRef = useRef(onInvalidate);

  useEffect(() => {
    onInvalidateRef.current = onInvalidate;
  }, [onInvalidate]);

  const { data: courseGenerationMessages } = useCourseGenerationMessages(
    courseId,
    Boolean(courseId && draftId),
  );

  const invalidateGenerationQueries = useCallback(async () => {
    if (!courseId) return;

    await invalidateCourseGenerationSyncQueries(courseId);

    onInvalidateRef.current?.();
  }, [courseId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<CourseGenerationUIMessage>({
        api: chatUrl,
        credentials: "include",
        prepareSendMessagesRequest: ({ messages }) => {
          const message = messages[messages.length - 1];

          return {
            body: {
              integrationId: courseId,
              message,
            },
            credentials: "include",
          };
        },
      }),
    [courseId],
  );

  const { messages, setMessages, status, sendMessage } = useChat<CourseGenerationUIMessage>({
    transport,
    onFinish: () => {
      void invalidateGenerationQueries();
    },
    onError: () => {
      void invalidateGenerationQueries();
    },
  });

  useEffect(() => {
    setMessages(
      (courseGenerationMessages ?? []).map((message) =>
        createTextUiMessage<CourseGenerationUIMessage>({
          id: message.id,
          role: toUiMessageRole<CourseGenerationUIMessage["role"]>(message.role),
          content: message.content,
        }),
      ),
    );
  }, [courseGenerationMessages, setMessages]);

  const data = useMemo(() => getCourseGenerationStreamData(messages), [messages]);

  useEffect(() => {
    if (!hasCourseGeneratedFlag(data)) return;
    void invalidateGenerationQueries();
  }, [data, invalidateGenerationQueries]);

  const handleSubmit = useCallback(async () => {
    const message = input.trim();
    if (!message || !courseId) return;

    setInput("");
    await sendMessage({ text: message });
  }, [courseId, input, sendMessage]);

  return {
    messages,
    input,
    setInput,
    setMessages,
    status,
    data,
    handleSubmit,
  };
}
