import { ForbiddenException } from "@nestjs/common";

import { CourseChatService } from "src/course-chat/course-chat.service";

import type { EmailService } from "src/common/emails/emails.service";
import type { CourseChatPresenceService } from "src/course-chat/course-chat-presence.service";
import type { CourseChatRepository } from "src/course-chat/course-chat.repository";
import type {
  CourseChatMessageResponse,
  CourseChatThreadResponse,
} from "src/course-chat/schemas/course-chat.schema";
import type { RealtimePublisher } from "src/websocket/realtime.publisher";

const userId = "00000000-0000-0000-0000-000000000001";
const courseId = "00000000-0000-0000-0000-000000000002";
const threadId = "00000000-0000-0000-0000-000000000003";
const messageId = "00000000-0000-0000-0000-000000000004";
const mentionedUserId = "00000000-0000-0000-0000-000000000005";

const user = {
  id: userId,
  firstName: "Ada",
  lastName: "Lovelace",
  avatarReference: null,
};

const message: CourseChatMessageResponse = {
  id: messageId,
  threadId,
  courseId,
  userId,
  content: "Hello course",
  parentMessageId: null,
  deletedAt: null,
  createdAt: "2026-04-29T12:00:00.000Z",
  updatedAt: "2026-04-29T12:00:00.000Z",
  user,
};

const thread: CourseChatThreadResponse = {
  id: threadId,
  courseId,
  createdByUserId: userId,
  archived: false,
  createdAt: "2026-04-29T12:00:00.000Z",
  updatedAt: "2026-04-29T12:00:00.000Z",
  messageCount: 1,
  createdBy: user,
  rootMessage: message,
  latestMessage: message,
};

describe("CourseChatService", () => {
  let repository: jest.Mocked<CourseChatRepository>;
  let presenceService: jest.Mocked<CourseChatPresenceService>;
  let emailService: jest.Mocked<EmailService>;
  let realtimePublisher: jest.Mocked<RealtimePublisher>;
  let service: CourseChatService;

  beforeEach(() => {
    repository = {
      isUserEnrolledInCourse: jest.fn(),
      getThreads: jest.fn(),
      getThreadById: jest.fn(),
      getMessages: jest.fn(),
      getMessageById: jest.fn(),
      createThreadWithMessage: jest.fn(),
      createMessage: jest.fn(),
      messageBelongsToThread: jest.fn(),
      getMentionEmailRecipients: jest.fn(),
      getCourseEmailContext: jest.fn(),
    } as unknown as jest.Mocked<CourseChatRepository>;

    presenceService = {
      isOnline: jest.fn(),
    } as unknown as jest.Mocked<CourseChatPresenceService>;

    emailService = {
      getDefaultEmailProperties: jest.fn().mockResolvedValue({
        primaryColor: "#4796FD",
        companyName: "Mentingo",
        language: "en",
      }),
      sendEmailWithLogo: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    realtimePublisher = {
      emitToRoom: jest.fn(),
      emitToRoomWithAck: jest.fn(),
    };

    service = new CourseChatService(repository, presenceService, emailService, realtimePublisher);
  });

  it("blocks users who are not enrolled in the course", async () => {
    repository.isUserEnrolledInCourse.mockResolvedValue(false);

    await expect(service.getThreads({ courseId, userId })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("creates a thread with a trimmed first message for enrolled users", async () => {
    repository.isUserEnrolledInCourse.mockResolvedValue(true);
    repository.createThreadWithMessage.mockResolvedValue({ threadId, messageId });
    repository.getThreadById.mockResolvedValue(thread);
    repository.getMessageById.mockResolvedValue(message);

    const result = await service.createThread(courseId, userId, { content: "  Hello course  " });

    expect(repository.createThreadWithMessage).toHaveBeenCalledWith(
      courseId,
      userId,
      "Hello course",
    );
    expect(result.data).toEqual({ thread, message });
    expect(realtimePublisher.emitToRoom).toHaveBeenCalledWith(
      "course-chat:thread-created",
      `course-chat:${courseId}`,
      { thread, message },
    );
  });

  it("adds replies to the course that owns the thread", async () => {
    repository.getThreadById.mockResolvedValue(thread);
    repository.isUserEnrolledInCourse.mockResolvedValue(true);
    repository.createMessage.mockResolvedValue(messageId);
    repository.getMessageById.mockResolvedValue(message);

    await service.createMessage(threadId, userId, { content: "Reply" });

    expect(repository.createMessage).toHaveBeenCalledWith({
      threadId,
      courseId,
      userId,
      content: "Reply",
      parentMessageId: undefined,
    });
  });

  it("notifies enrolled users mentioned in a message", async () => {
    repository.getThreadById.mockResolvedValue(thread);
    repository.isUserEnrolledInCourse.mockResolvedValue(true);
    repository.createMessage.mockResolvedValue(messageId);
    repository.getMessageById.mockResolvedValue(message);
    repository.getMentionEmailRecipients.mockResolvedValue([
      {
        id: mentionedUserId,
        email: "mentioned@example.com",
        firstName: "Grace",
        tenantId: "00000000-0000-0000-0000-000000000006",
      },
    ]);
    repository.getCourseEmailContext.mockResolvedValue({
      title: { en: "Algorithms" },
      baseLanguage: "en",
    });

    await service.createMessage(threadId, userId, {
      content: `Hi @Ada Lovelace`,
      mentionedUserIds: [mentionedUserId, userId, mentionedUserId],
    });

    expect(repository.getMentionEmailRecipients).toHaveBeenCalledWith(courseId, [mentionedUserId]);
    expect(realtimePublisher.emitToRoom).toHaveBeenCalledWith(
      "course-chat:user-mentioned",
      `user:${mentionedUserId}`,
      { courseId, message },
    );
    expect(emailService.sendEmailWithLogo).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "mentioned@example.com",
        subject: "You were mentioned in Algorithms",
      }),
      { tenantId: "00000000-0000-0000-0000-000000000006" },
    );
  });
});
