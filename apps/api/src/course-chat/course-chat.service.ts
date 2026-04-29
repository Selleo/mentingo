import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BaseEmailTemplate } from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { BaseResponse, PaginatedResponse } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import { CourseChatPresenceService } from "src/course-chat/course-chat-presence.service";
import {
  COURSE_CHAT_ALLOWED_REACTIONS,
  COURSE_CHAT_SOCKET_EVENTS,
  getCourseChatRoom,
} from "src/course-chat/course-chat.constants";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { REALTIME_PUBLISHER } from "src/websocket/realtime.publisher";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type {
  CourseChatMessageResponse,
  CourseChatThreadResponse,
  CourseChatUserResponse,
  CreateCourseChatMessageBody,
  CreateCourseChatThreadBody,
  CreateCourseChatThreadResponse,
  ToggleCourseChatMessageReactionBody,
} from "src/course-chat/schemas/course-chat.schema";

type CourseChatRealtimePublisher = {
  emitToRoom(event: string, roomId: string, payload: unknown): void;
};

@Injectable()
export class CourseChatService {
  constructor(
    private readonly courseChatRepository: CourseChatRepository,
    private readonly courseChatPresenceService: CourseChatPresenceService,
    private readonly emailService: EmailService,
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: CourseChatRealtimePublisher,
  ) {}

  async assertUserEnrolledInCourse(courseId: UUIDType, userId: UUIDType) {
    const isEnrolled = await this.courseChatRepository.isUserEnrolledInCourse(courseId, userId);

    if (!isEnrolled) {
      throw new ForbiddenException("courseChat.errors.notEnrolled");
    }
  }

  async getThreads(params: {
    courseId: UUIDType;
    userId: UUIDType;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<CourseChatThreadResponse[]>> {
    await this.assertUserEnrolledInCourse(params.courseId, params.userId);

    const threads = await this.courseChatRepository.getThreads(
      params.courseId,
      params.userId,
      params.page,
      params.perPage,
    );

    return new PaginatedResponse(threads);
  }

  async getMessages(params: {
    threadId: UUIDType;
    userId: UUIDType;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedResponse<CourseChatMessageResponse[]>> {
    const thread = await this.getAccessibleThread(params.threadId, params.userId);
    const messages = await this.courseChatRepository.getMessages(
      thread.id,
      params.userId,
      params.page,
      params.perPage,
    );

    return new PaginatedResponse(messages);
  }

  async getUsers(
    courseId: UUIDType,
    userId: UUIDType,
  ): Promise<BaseResponse<CourseChatUserResponse[]>> {
    await this.assertUserEnrolledInCourse(courseId, userId);

    const users = await this.courseChatRepository.getEnrolledUsers(courseId);

    return new BaseResponse(
      users.map((user) => ({
        ...user,
        isOnline: this.courseChatPresenceService.isOnline(courseId, user.id),
      })),
    );
  }

  async createThread(
    courseId: UUIDType,
    userId: UUIDType,
    body: CreateCourseChatThreadBody,
  ): Promise<BaseResponse<CreateCourseChatThreadResponse>> {
    await this.assertUserEnrolledInCourse(courseId, userId);

    const content = this.normalizeContent(body.content);
    const { threadId, messageId } = await this.courseChatRepository.createThreadWithMessage(
      courseId,
      userId,
      content,
    );

    const [thread, message] = await Promise.all([
      this.courseChatRepository.getThreadById(threadId, userId),
      this.courseChatRepository.getMessageById(messageId, userId),
    ]);

    if (!thread || !message) throw new NotFoundException("courseChat.errors.notFound");

    const payload = { thread, message };
    const room = getCourseChatRoom(courseId);
    this.realtimePublisher.emitToRoom(COURSE_CHAT_SOCKET_EVENTS.THREAD_CREATED, room, payload);
    this.realtimePublisher.emitToRoom(COURSE_CHAT_SOCKET_EVENTS.MESSAGE_CREATED, room, message);
    await this.emitMentionNotifications({
      courseId,
      actorUserId: userId,
      message,
      mentionedUserIds: body.mentionedUserIds,
    });

    return new BaseResponse(payload);
  }

  async createMessage(
    threadId: UUIDType,
    userId: UUIDType,
    body: CreateCourseChatMessageBody,
  ): Promise<BaseResponse<CourseChatMessageResponse>> {
    const thread = await this.getAccessibleThread(threadId, userId);

    if (body.parentMessageId) {
      const parentBelongsToThread = await this.courseChatRepository.messageBelongsToThread(
        body.parentMessageId,
        thread.id,
      );

      if (!parentBelongsToThread) {
        throw new BadRequestException("courseChat.errors.invalidParentMessage");
      }
    }

    const messageId = await this.courseChatRepository.createMessage({
      threadId: thread.id,
      courseId: thread.courseId,
      userId,
      content: this.normalizeContent(body.content),
      parentMessageId: body.parentMessageId,
    });

    const message = await this.courseChatRepository.getMessageById(messageId, userId);
    if (!message) throw new NotFoundException("courseChat.errors.notFound");

    this.realtimePublisher.emitToRoom(
      COURSE_CHAT_SOCKET_EVENTS.MESSAGE_CREATED,
      getCourseChatRoom(thread.courseId),
      message,
    );
    await this.emitMentionNotifications({
      courseId: thread.courseId,
      actorUserId: userId,
      message,
      mentionedUserIds: body.mentionedUserIds,
    });

    return new BaseResponse(message);
  }

  async toggleMessageReaction(
    messageId: UUIDType,
    userId: UUIDType,
    body: ToggleCourseChatMessageReactionBody,
  ) {
    if (!this.isAllowedReaction(body.reaction)) {
      throw new BadRequestException("courseChat.errors.invalidReaction");
    }

    const message = await this.courseChatRepository.getMessageContext(messageId);
    if (!message) throw new NotFoundException("courseChat.errors.messageNotFound");

    await this.assertUserEnrolledInCourse(message.courseId, userId);

    await this.courseChatRepository.toggleMessageReaction({
      messageId,
      courseId: message.courseId,
      userId,
      reaction: body.reaction,
    });

    const reactions = await this.courseChatRepository.getMessageReactions(messageId, userId);
    const payload = {
      courseId: message.courseId,
      threadId: message.threadId,
      messageId,
      reactions,
    };

    this.realtimePublisher.emitToRoom(
      COURSE_CHAT_SOCKET_EVENTS.MESSAGE_REACTIONS_UPDATED,
      getCourseChatRoom(message.courseId),
      payload,
    );

    return new BaseResponse(payload);
  }

  private async getAccessibleThread(threadId: UUIDType, userId: UUIDType) {
    const thread = await this.courseChatRepository.getThreadById(threadId, userId);

    if (!thread || thread.archived) {
      throw new NotFoundException("courseChat.errors.threadNotFound");
    }

    await this.assertUserEnrolledInCourse(thread.courseId, userId);

    return thread;
  }

  private normalizeContent(content: string) {
    const normalized = content.trim();

    if (!normalized) {
      throw new BadRequestException("courseChat.errors.emptyMessage");
    }

    return normalized;
  }

  private isAllowedReaction(reaction: string) {
    return (COURSE_CHAT_ALLOWED_REACTIONS as readonly string[]).includes(reaction);
  }

  private async emitMentionNotifications(params: {
    courseId: UUIDType;
    actorUserId: UUIDType;
    message: CourseChatMessageResponse;
    mentionedUserIds?: UUIDType[];
  }) {
    const uniqueMentionedUserIds = Array.from(new Set(params.mentionedUserIds ?? [])).filter(
      (mentionedUserId) => mentionedUserId !== params.actorUserId,
    );

    if (!uniqueMentionedUserIds.length) return;

    const [recipients, courseContext] = await Promise.all([
      this.courseChatRepository.getMentionEmailRecipients(params.courseId, uniqueMentionedUserIds),
      this.courseChatRepository.getCourseEmailContext(params.courseId),
    ]);

    for (const recipient of recipients) {
      this.realtimePublisher.emitToRoom(
        COURSE_CHAT_SOCKET_EVENTS.USER_MENTIONED,
        `user:${recipient.id}`,
        {
          courseId: params.courseId,
          message: params.message,
        },
      );
    }

    if (!courseContext) return;

    await Promise.allSettled(
      recipients.map(async (recipient) => {
        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          recipient.tenantId,
          recipient.id,
        );
        const courseName = this.getLocalizedCourseTitle(
          courseContext.title,
          defaultEmailSettings.language,
          courseContext.baseLanguage,
        );
        const authorName = `${params.message.user.firstName} ${params.message.user.lastName}`;
        const { text, html } = new BaseEmailTemplate({
          heading: this.getMentionEmailHeading(defaultEmailSettings.language),
          paragraphs: this.getMentionEmailParagraphs(defaultEmailSettings.language, {
            recipientName: recipient.firstName,
            authorName,
            courseName,
            messageContent: params.message.content,
          }),
          buttonText: this.getMentionEmailButtonText(defaultEmailSettings.language),
          buttonLink: `${process.env.CORS_ORIGIN}/course/${params.courseId}`,
          ...defaultEmailSettings,
        });

        await this.emailService.sendEmailWithLogo(
          {
            to: recipient.email,
            subject: getEmailSubject("courseChatMentionEmail", defaultEmailSettings.language, {
              courseName,
            }),
            text,
            html,
          },
          { tenantId: recipient.tenantId },
        );
      }),
    );
  }

  private getLocalizedCourseTitle(
    title: Record<string, string>,
    language: SupportedLanguages,
    baseLanguage: string,
  ) {
    return title[language] ?? title[baseLanguage] ?? title[SUPPORTED_LANGUAGES.EN] ?? "Course";
  }

  private getMentionEmailHeading(language: SupportedLanguages) {
    return (
      {
        en: "You were mentioned in course chat",
        pl: "Oznaczono Cię na czacie kursu",
        de: "Du wurdest im Kurschat erwähnt",
        lt: "Buvote paminėti kurso pokalbyje",
        cs: "Byl(a) jste zmíněn(a) v chatu kurzu",
      } satisfies Record<SupportedLanguages, string>
    )[language];
  }

  private getMentionEmailButtonText(language: SupportedLanguages) {
    return (
      {
        en: "Open course chat",
        pl: "Otwórz czat kursu",
        de: "Kurschat öffnen",
        lt: "Atidaryti kurso pokalbį",
        cs: "Otevřít chat kurzu",
      } satisfies Record<SupportedLanguages, string>
    )[language];
  }

  private getMentionEmailParagraphs(
    language: SupportedLanguages,
    params: {
      recipientName: string;
      authorName: string;
      courseName: string;
      messageContent: string;
    },
  ) {
    const translations = {
      en: [
        `Hi ${params.recipientName}, ${params.authorName} mentioned you in ${params.courseName}.`,
        `"${params.messageContent}"`,
      ],
      pl: [
        `Cześć ${params.recipientName}, ${params.authorName} oznaczył(a) Cię w kursie ${params.courseName}.`,
        `"${params.messageContent}"`,
      ],
      de: [
        `Hallo ${params.recipientName}, ${params.authorName} hat dich in ${params.courseName} erwähnt.`,
        `"${params.messageContent}"`,
      ],
      lt: [
        `Sveiki, ${params.recipientName}, ${params.authorName} paminėjo jus kurse ${params.courseName}.`,
        `"${params.messageContent}"`,
      ],
      cs: [
        `Ahoj ${params.recipientName}, ${params.authorName} vás zmínil(a) v kurzu ${params.courseName}.`,
        `"${params.messageContent}"`,
      ],
    } satisfies Record<SupportedLanguages, string[]>;

    return translations[language];
  }
}
