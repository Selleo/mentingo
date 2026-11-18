import { setForumFeatureState } from "../utils/forum-features";

import type { FixtureApiClient } from "../utils/api-client";
import type { CreateMessageBody } from "~/api/generated-api";

const DISCUSSION_PAGE_SIZE = 10;

export class CourseDiscussionFactory {
  constructor(private readonly apiClient: FixtureApiClient) {}

  async setEnabled(enabled: boolean) {
    await setForumFeatureState(this.apiClient, { courseDiscussionsEnabled: enabled });
  }

  async createMessage(courseId: string, input: CreateMessageBody) {
    const response = await this.apiClient.api.courseChatControllerCreateMessage(courseId, input);

    return response.data.data;
  }

  async toggleReaction(messageId: string, reaction: string) {
    await this.apiClient.api.courseChatControllerToggleMessageReaction(messageId, { reaction });
  }

  async deleteMessage(messageId: string) {
    await this.apiClient.api.courseChatControllerDeleteMessage(messageId);
  }

  /** Searches the first page of top-level threads, which holds the newest ones. */
  async findThread(courseId: string, match: { id?: string; content?: string }) {
    const response = await this.apiClient.api.courseChatControllerGetMessages(courseId, {
      page: 1,
      perPage: DISCUSSION_PAGE_SIZE,
    });

    return (
      response.data.data.find(
        (message) => message.id === match.id || message.content === match.content,
      ) ?? null
    );
  }

  async getReactionCount(courseId: string, messageId: string, reaction: string) {
    const message = await this.findThread(courseId, { id: messageId });

    return message?.reactions.find((entry) => entry.reaction === reaction)?.count ?? 0;
  }

  async findReply(messageId: string, content: string) {
    const response = await this.apiClient.api.courseChatControllerGetReplies(messageId, {
      page: 1,
      perPage: DISCUSSION_PAGE_SIZE,
    });

    return response.data.data.find((message) => message.content === content) ?? null;
  }
}
