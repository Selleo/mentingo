import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef } from "react";

import { useCourseGenerationMessages } from "~/api/queries/admin/useCourseGenerationMessages";
import { hasCourseGeneratedFlag } from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationChat.utils";
import { invalidateCourseGenerationSyncQueries } from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationSync.utils";

import type { Message } from "@ai-sdk/react";

type UseCourseGenerationChatOptions = {
  courseId: string;
  draftId?: string;
  onInvalidate?: () => void;
};

const apiUrl = import.meta.env.VITE_API_URL;
const chatUrl = apiUrl
  ? `${apiUrl}/api/luma/course-generation/chat`
  : "/api/luma/course-generation/chat";

export function useCourseGenerationChat({
  courseId,
  draftId,
  onInvalidate,
}: UseCourseGenerationChatOptions) {
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

  const chat = useChat({
    api: chatUrl,
    body: {
      integrationId: courseId,
    },
    fetch: async (url, options) => {
      const body = JSON.parse((options?.body as string) ?? "{}");

      return fetch(url, {
        ...options,
        body: JSON.stringify({
          integrationId: courseId,
          message: body.messages?.[body.messages.length - 1]?.content || "",
        }),
        credentials: "include",
      });
    },
    onFinish: invalidateGenerationQueries,
    onError: () => {
      void invalidateGenerationQueries();
    },
  });

  const { data, setMessages } = chat;

  useEffect(() => {
    setMessages(
      (courseGenerationMessages ?? []).map(
        (message): Message => ({
          id: message.id,
          role: message.role as Message["role"],
          content: message.content,
        }),
      ),
    );
  }, [courseGenerationMessages, setMessages]);

  useEffect(() => {
    if (!hasCourseGeneratedFlag(data)) return;
    void invalidateGenerationQueries();
  }, [data, invalidateGenerationQueries]);
  return chat;
}
