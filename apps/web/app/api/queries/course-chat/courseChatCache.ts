import { queryClient } from "~/api/queryClient";

import { COURSE_CHAT_MESSAGES_QUERY_KEY } from "./useCourseChatMessages";
import { COURSE_CHAT_REPLIES_QUERY_KEY } from "./useCourseChatReplies";
import { getCourseChatUsersQueryKey } from "./useCourseChatUsers";

import type {
  CourseChatMessage,
  CourseChatMessagePreview,
  CourseChatUser,
} from "./courseChatTypes";
import type {
  DeleteMessageResponse,
  GetMessagesResponse,
  ToggleMessageReactionResponse,
} from "~/api/generated-api";

export function invalidateCourseChatMessages(courseId: string) {
  queryClient.invalidateQueries({
    queryKey: [...COURSE_CHAT_MESSAGES_QUERY_KEY, courseId],
  });
}

export function invalidateCourseChatReplies(messageId: string) {
  queryClient.invalidateQueries({
    queryKey: [...COURSE_CHAT_REPLIES_QUERY_KEY, messageId],
  });
}

export function invalidateCourseChatMessageCreated(params: {
  courseId: string;
  parentMessageId?: string | null;
}) {
  invalidateCourseChatMessages(params.courseId);

  if (params.parentMessageId) {
    invalidateCourseChatReplies(params.parentMessageId);
  }
}

export function updateCourseChatUserPresence(params: {
  courseId: string;
  userId: string;
  isOnline: boolean;
}) {
  queryClient.setQueryData<CourseChatUser[]>(
    getCourseChatUsersQueryKey(params.courseId),
    (current) =>
      current?.map((user) =>
        user.id === params.userId ? { ...user, isOnline: params.isOnline } : user,
      ),
  );
}

export function updateMessageReactionsInCache(payload: ToggleMessageReactionResponse["data"]) {
  const updatePreview = <T extends CourseChatMessagePreview>(message: T): T =>
    message.id === payload.messageId ? { ...message, reactions: payload.reactions } : message;

  const updateMessage = (message: CourseChatMessage): CourseChatMessage => ({
    ...updatePreview(message),
    latestReply: message.latestReply ? updatePreview(message.latestReply) : null,
  });

  queryClient.setQueriesData<GetMessagesResponse>(
    { queryKey: [...COURSE_CHAT_MESSAGES_QUERY_KEY, payload.courseId] },
    (current) =>
      current
        ? {
            ...current,
            data: current.data.map(updateMessage),
          }
        : current,
  );

  queryClient.invalidateQueries({ queryKey: COURSE_CHAT_REPLIES_QUERY_KEY });
}

export function updateDeletedMessageInCache(payload: DeleteMessageResponse["data"]) {
  queryClient.invalidateQueries({
    queryKey: [...COURSE_CHAT_MESSAGES_QUERY_KEY, payload.courseId],
  });

  if (payload.parentMessageId) {
    queryClient.invalidateQueries({
      queryKey: [...COURSE_CHAT_REPLIES_QUERY_KEY, payload.parentMessageId],
    });
  }
}
