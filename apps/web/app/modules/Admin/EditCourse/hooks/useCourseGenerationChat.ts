import { useChat } from "@ai-sdk/react";
import { useCallback, useEffect, useRef } from "react";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { COURSE_GENERATION_DRAFT_QUERY_KEY } from "~/api/queries/admin/useCourseGenerationDraft";
import {
  getCourseGenerationMessagesQueryKey,
  useCourseGenerationMessages,
} from "~/api/queries/admin/useCourseGenerationMessages";
import { queryClient } from "~/api/queryClient";
import { hasCourseGeneratedFlag } from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationChat.utils";
import { updateGeneratedCourseCacheFromStreamData } from "~/modules/Admin/EditCourse/components/course-generation/utils/courseGenerationCourseCache.utils";

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

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: getCourseGenerationMessagesQueryKey(courseId),
      }),
      queryClient.invalidateQueries({
        queryKey: [COURSE_GENERATION_DRAFT_QUERY_KEY],
      }),
      queryClient.invalidateQueries({
        queryKey: [COURSE_QUERY_KEY],
      }),
      queryClient.invalidateQueries({
        queryKey: ["course"],
      }),
    ]);

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
    if (!courseId || !Array.isArray(data)) return;
    const events = updateGeneratedCourseCacheFromStreamData(queryClient, courseId, data);

    if (events.invalidate) void invalidateGenerationQueries();
  }, [courseId, data, invalidateGenerationQueries]);

  useEffect(() => {
    if (!hasCourseGeneratedFlag(data)) return;
    void queryClient.invalidateQueries({
      queryKey: [COURSE_GENERATION_DRAFT_QUERY_KEY],
    });
  }, [data]);
  return chat;
}
