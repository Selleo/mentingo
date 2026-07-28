import { Inject, Injectable, Logger } from "@nestjs/common";
import { and, desc, eq, isNotNull } from "drizzle-orm";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { DatabasePg } from "src/common";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { CourseService } from "src/courses/course.service";
import {
  AnnouncementPublishedEvent,
  CertificateArchivedEmailEvent,
  CertificateExpirationWarningEmailEvent,
  CourseChatUserMentionedEvent,
  CourseCompletedEvent,
  CourseDueDateReminderEmailEvent,
  UserChapterFinishedEvent,
  UserCourseFinishedEvent,
  UserFirstLoginEvent,
  UserInviteEvent,
  UserPasswordCreatedEvent,
  UserPasswordReminderEvent,
  UserRegisteredEvent,
  UsersAssignedToCourseEvent,
  UsersImportInviteEmailsEvent,
  UsersLongInactivityEvent,
  UsersShortInactivityEvent,
  UserWelcomeEvent,
} from "src/events";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { courses, studentCourses, users } from "src/storage/schema";
import { UserService } from "src/user/user.service";

import type { AutomationResolvedRecipient } from "./automation-data-resolver.types";
import type { AutomationEventTypes } from "../handlers/automations-handler";
import type { UUIDType } from "src/common";

@Injectable()
export class AutomationDataResolverService {
  private readonly logger = new Logger(AutomationDataResolverService.name);

  constructor(
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private readonly userService: UserService,
    private readonly courseService: CourseService,
    private readonly announcementsRepository: AnnouncementsRepository,
    private readonly courseChatRepository: CourseChatRepository,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async resolve(event: AutomationEventTypes): Promise<AutomationResolvedRecipient[]> {
    if (event instanceof UserInviteEvent) {
      return this.resolveUserInvite(event);
    }
    if (event instanceof UsersImportInviteEmailsEvent) {
      return this.resolveUsersImportInvite(event);
    }
    if (event instanceof UserPasswordReminderEvent) {
      return this.resolveUserPasswordReminder(event);
    }
    if (event instanceof UserWelcomeEvent) {
      return this.resolveUserWelcome(event);
    }
    if (event instanceof UserFirstLoginEvent) {
      return this.resolveUserFirstLogin(event);
    }
    if (event instanceof UsersAssignedToCourseEvent) {
      return this.resolveUsersAssignedToCourse(event);
    }
    if (event instanceof UsersShortInactivityEvent) {
      return this.resolveUsersShortInactivity(event);
    }
    if (event instanceof UsersLongInactivityEvent) {
      return this.resolveUsersLongInactivity(event);
    }
    if (event instanceof UserChapterFinishedEvent) {
      return this.resolveUserChapterFinished(event);
    }
    if (event instanceof UserCourseFinishedEvent) {
      return this.resolveUserCourseFinished(event);
    }
    if (event instanceof UserRegisteredEvent) {
      return this.resolveUserRegistered(event);
    }
    if (event instanceof UserPasswordCreatedEvent) {
      return this.resolveUserPasswordCreated(event);
    }
    if (event instanceof CourseCompletedEvent) {
      return this.resolveCourseCompleted(event);
    }
    if (event instanceof CertificateExpirationWarningEmailEvent) {
      return this.resolveCertificateExpirationWarning(event);
    }
    if (event instanceof CertificateArchivedEmailEvent) {
      return this.resolveCertificateArchived(event);
    }
    if (event instanceof AnnouncementPublishedEvent) {
      return this.resolveAnnouncementPublished(event);
    }
    if (event instanceof CourseChatUserMentionedEvent) {
      return this.resolveCourseChatUserMentioned(event);
    }
    if (event instanceof CourseDueDateReminderEmailEvent) {
      return this.resolveCourseDueDateReminder(event);
    }

    this.logger.warn(`No resolver for event: ${(event as object).constructor.name}`);
    return [];
  }

  // ─── Individual resolvers ──────────────────────────────────────────

  private async resolveUserInvite(event: UserInviteEvent): Promise<AutomationResolvedRecipient[]> {
    const { email, userId, tenantId, token, invitedByUserName } = event.userInvite;
    const user = await this.getUserSafe(userId);
    const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);
    const inviteLink = `${origin}/create-password?createToken=${token}`;

    return [
      {
        userId,
        userEmail: email,
        tenantId,
        variables: {
          userFirstName: user?.firstName ?? "",
          userLastName: user?.lastName ?? "",
          userEmail: email,
          inviteLink,
          invitedByUserName: invitedByUserName ?? "Admin",
        },
      },
    ];
  }

  private async resolveUsersImportInvite(
    event: UsersImportInviteEmailsEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { tenantId, recipients, invitedByUserName } = event.usersImportInviteEmails;
    const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);

    const results: AutomationResolvedRecipient[] = [];

    for (const recipient of recipients) {
      const user = await this.getUserSafe(recipient.userId);
      const inviteLink = `${origin}/create-password?createToken=${recipient.token}`;

      results.push({
        userId: recipient.userId,
        userEmail: recipient.email,
        tenantId,
        variables: {
          userFirstName: user?.firstName ?? "",
          userLastName: user?.lastName ?? "",
          userEmail: recipient.email,
          inviteLink,
          invitedByUserName: invitedByUserName ?? "Admin",
        },
      });
    }

    return results;
  }

  private async resolveUserPasswordReminder(
    event: UserPasswordReminderEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { email, userId, tenantId, token, origin } = event.userPasswordReminder;
    const user = await this.getUserSafe(userId);
    const baseOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId, origin);
    const resetPasswordLink = `${baseOrigin}/create-password?createToken=${token}`;

    return [
      {
        userId,
        userEmail: email,
        tenantId,
        variables: {
          userFirstName: user?.firstName ?? "",
          userLastName: user?.lastName ?? "",
          userEmail: email,
          resetPasswordLink,
        },
      },
    ];
  }

  private async resolveUserWelcome(
    event: UserWelcomeEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { email, userId, tenantId, origin } = event.userWelcome;
    const user = await this.getUserSafe(userId);
    const baseOrigin = await resolveTenantOrigin(this.dbAdmin, tenantId, origin);

    return [
      {
        userId,
        userEmail: email,
        tenantId,
        variables: {
          userFirstName: user?.firstName ?? "",
          userLastName: user?.lastName ?? "",
          userEmail: email,
          platformUrl: `${baseOrigin}/courses`,
        },
      },
    ];
  }

  private async resolveUserFirstLogin(
    event: UserFirstLoginEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { userId } = event.userFirstLogin;
    const user = await this.userService.getUserById(userId, this.dbAdmin);
    const origin = await resolveTenantOrigin(this.dbAdmin, user.tenantId);

    return [
      {
        userId,
        userEmail: user.email,
        tenantId: user.tenantId,
        variables: {
          userFirstName: user.firstName,
          userLastName: user.lastName,
          userEmail: user.email,
          loginDate: new Date().toISOString(),
          platformUrl: `${origin}/courses`,
        },
      },
    ];
  }

  private async resolveUsersAssignedToCourse(
    event: UsersAssignedToCourseEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { studentIds, courseId } = event.usersAssignedToCourse;
    const tenantId = await this.getCourseTenantId(courseId);

    return this.tenantRunner.runWithTenant(tenantId, async () => {
      const { courseName } = await this.courseService.getCourseEmailData(courseId);
      const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);
      const courseUrl = `${origin}/course/${courseId}`;

      const dueDates = await this.courseService.getStudentsDueDatesForCourse(courseId, studentIds);

      const results: AutomationResolvedRecipient[] = [];

      for (const studentId of studentIds) {
        const user = await this.getUserSafe(studentId);
        if (!user) continue;

        results.push({
          userId: studentId,
          userEmail: user.email,
          tenantId,
          variables: {
            userFirstName: user.firstName,
            userLastName: user.lastName,
            userEmail: user.email,
            courseName: courseName ?? "",
            courseUrl,
            dueDate: dueDates[studentId] ?? "",
          },
        });
      }

      return results;
    });
  }

  private async resolveUsersShortInactivity(
    event: UsersShortInactivityEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { tenantId, users: inactiveUsers } = event.usersShortInactivity;
    const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);

    return inactiveUsers.map((u) => ({
      userEmail: u.email,
      tenantId,
      variables: {
        userFirstName: u.name.split(" ")[0] ?? "",
        userLastName: u.name.split(" ").slice(1).join(" ") ?? "",
        userEmail: u.email,
        courseName: "",
        courseUrl: `${origin}/courses`,
        daysInactive: "",
      },
    }));
  }

  private async resolveUsersLongInactivity(
    event: UsersLongInactivityEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { tenantId, users: inactiveUsers } = event.usersLongInactivity;
    const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);

    return inactiveUsers.map((u) => ({
      userEmail: u.email,
      tenantId,
      variables: {
        userFirstName: u.name.split(" ")[0] ?? "",
        userLastName: u.name.split(" ").slice(1).join(" ") ?? "",
        userEmail: u.email,
        courseName: "",
        courseUrl: `${origin}/courses`,
        daysInactive: "",
      },
    }));
  }

  private async resolveUserChapterFinished(
    event: UserChapterFinishedEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { courseId, chapterId, userId, actor } = event.chapterFinishedData;
    const user = await this.userService.getUserById(userId, this.dbAdmin);
    const tenantId = actor.tenantId;

    return this.tenantRunner.runWithTenant(tenantId, async () => {
      const { courseName } = await this.courseService.getCourseEmailData(courseId);
      const chapterName = await this.courseService.getChapterName(chapterId);
      const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);

      return [
        {
          userId,
          userEmail: user.email,
          tenantId,
          variables: {
            userFirstName: user.firstName,
            userLastName: user.lastName,
            userEmail: user.email,
            courseName: courseName ?? "",
            chapterName: chapterName ?? "",
            courseUrl: `${origin}/course/${courseId}`,
          },
        },
      ];
    });
  }

  private async resolveUserCourseFinished(
    event: UserCourseFinishedEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { courseId, userId, actor } = event.courseFinishedData;
    const user = await this.userService.getUserById(userId, this.dbAdmin);
    const tenantId = actor.tenantId;

    return this.tenantRunner.runWithTenant(tenantId, async () => {
      const { courseName, hasCertificate } = await this.courseService.getCourseEmailData(courseId);
      const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);
      const certificateUrl = hasCertificate ? `${origin}/certificates` : "";

      return [
        {
          userId,
          userEmail: user.email,
          tenantId,
          variables: {
            userFirstName: user.firstName,
            userLastName: user.lastName,
            userEmail: user.email,
            courseName: courseName ?? "",
            finishedAt: new Date().toISOString(),
            certificateUrl,
            hasCertificate: String(hasCertificate ?? false),
            courseUrl: `${origin}/course/${courseId}`,
          },
        },
      ];
    });
  }

  private async resolveUserRegistered(
    event: UserRegisteredEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { id, firstName, lastName, email } = event.user;
    const tenantId = await this.getUserTenantId(id);
    const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);

    return [
      {
        userId: id,
        userEmail: email,
        tenantId,
        variables: {
          userFirstName: firstName,
          userLastName: lastName,
          userEmail: email,
          registrationDate: new Date().toISOString(),
          profileLink: `${origin}/admin/users/${id}`,
          userName: [firstName, lastName].filter(Boolean).join(" "),
        },
      },
    ];
  }

  private async resolveUserPasswordCreated(
    event: UserPasswordCreatedEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { id, firstName, lastName, email } = event.user;
    const tenantId = await this.getUserTenantId(id);

    return [
      {
        userId: id,
        userEmail: email,
        tenantId,
        variables: {
          userFirstName: firstName,
          userLastName: lastName,
          userEmail: email,
          createdAt: new Date().toISOString(),
        },
      },
    ];
  }

  private async resolveCourseCompleted(
    event: CourseCompletedEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { courseId, userName, courseTitle } = event.courseCompletionData;
    const tenantId = await this.getCourseTenantId(courseId);
    const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);

    const completedStudent = await this.getLastCompletedStudentForCourse(courseId);

    const nameParts = userName.split(" ");
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") ?? "";

    return [
      {
        userEmail: completedStudent?.email ?? "",
        tenantId,
        variables: {
          userFirstName: firstName,
          userLastName: lastName,
          userEmail: completedStudent?.email ?? "",
          courseName: courseTitle,
          finishedAt: new Date().toISOString(),
          userName,
          progressLink: `${origin}/admin/courses/${courseId}/progress`,
        },
      },
    ];
  }

  private async resolveCertificateExpirationWarning(
    event: CertificateExpirationWarningEmailEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { certificates } = event.certificateExpirationWarningEmailData;

    const results: AutomationResolvedRecipient[] = [];

    for (const cert of certificates) {
      const user = await this.getUserSafe(cert.userId);

      results.push({
        userId: cert.userId,
        userEmail: cert.userEmail,
        tenantId: cert.tenantId,
        variables: {
          userFirstName: user?.firstName ?? "",
          userLastName: user?.lastName ?? "",
          userEmail: cert.userEmail,
          certificateName: cert.courseName,
          expirationDate: cert.expiresAt,
          daysLeft: "",
          courseUrl: cert.courseLink,
        },
      });
    }

    return results;
  }

  private async resolveCertificateArchived(
    event: CertificateArchivedEmailEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { certificates, reason } = event.certificateArchivedEmailData;

    const results: AutomationResolvedRecipient[] = [];

    for (const cert of certificates) {
      const user = await this.getUserSafe(cert.userId);

      results.push({
        userId: cert.userId,
        userEmail: cert.userEmail,
        tenantId: cert.tenantId,
        variables: {
          userFirstName: user?.firstName ?? "",
          userLastName: user?.lastName ?? "",
          userEmail: cert.userEmail,
          certificateName: cert.courseName,
          archivedAt: new Date().toISOString(),
          courseUrl: cert.courseLink,
          archiveReason: reason ?? "expired",
        },
      });
    }

    return results;
  }

  private async resolveAnnouncementPublished(
    event: AnnouncementPublishedEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { announcementId } = event.announcementPublishedData;
    const [announcement] = await this.announcementsRepository.getAnnouncementById(announcementId);

    if (!announcement) return [];

    const tenantId = announcement.tenantId;
    const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);
    const title = String(Object.values(announcement.title ?? {})[0] ?? "");
    const content = String(Object.values(announcement.content ?? {})[0] ?? "");
    const announcementUrl = `${origin}/announcements`;

    const recipients =
      await this.announcementsRepository.getAnnouncementEmailRecipients(announcementId);

    if (recipients.length === 0) return [];

    const results: AutomationResolvedRecipient[] = [];

    for (const recipient of recipients) {
      const user = await this.getUserSafe(recipient.id);

      results.push({
        userId: recipient.id,
        userEmail: recipient.email,
        tenantId,
        variables: {
          userFirstName: user?.firstName ?? "",
          userLastName: user?.lastName ?? "",
          announcementTitle: title,
          announcementContent: content,
          announcementUrl,
        },
      });
    }

    return results;
  }

  private async resolveCourseChatUserMentioned(
    event: CourseChatUserMentionedEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { tenantId, courseId, actorUserId, messageId, mentionedUserIds } =
      event.courseChatUserMentionedData;

    return this.tenantRunner.runWithTenant(tenantId, async () => {
      const message = await this.courseChatRepository.getMessageById(messageId);
      if (!message) return [];

      const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);
      const { courseName } = await this.courseService.getCourseEmailData(courseId);
      const authorName = `${message.userFirstName} ${message.userLastName}`;
      const chatUrl = `${origin}/course/${courseId}?tab=Discussion`;

      const results: AutomationResolvedRecipient[] = [];

      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId === actorUserId) continue;
        const user = await this.getUserSafe(mentionedUserId);
        if (!user) continue;

        results.push({
          userId: mentionedUserId,
          userEmail: user.email,
          tenantId,
          variables: {
            userFirstName: user.firstName,
            userLastName: user.lastName,
            authorFullName: authorName,
            courseName: courseName ?? "",
            messageContent: message.content ?? "",
            chatUrl,
          },
        });
      }

      return results;
    });
  }

  private async resolveCourseDueDateReminder(
    event: CourseDueDateReminderEmailEvent,
  ): Promise<AutomationResolvedRecipient[]> {
    const { recipients } = event.courseDueDateReminderEmailData;

    const results: AutomationResolvedRecipient[] = [];

    for (const r of recipients) {
      const user = await this.getUserSafe(r.studentId);

      results.push({
        userId: r.studentId,
        userEmail: r.studentEmail,
        tenantId: r.tenantId,
        variables: {
          userFirstName: user?.firstName ?? "",
          userLastName: user?.lastName ?? "",
          userEmail: r.studentEmail,
          courseName: r.courseName,
          dueDate: r.dueDate,
          daysLeft: String(r.daysBeforeDueDate),
          courseUrl: `${r.tenantHost.replace(/\/$/, "")}/course/${r.courseId}`,
        },
      });
    }

    return results;
  }

  // ─── Helpers ───────────────────────────────────────────────────────

  private async getUserSafe(userId: UUIDType) {
    try {
      return await this.userService.getUserById(userId, this.dbAdmin);
    } catch {
      this.logger.warn(`Could not resolve user ${userId} for automation data`);
      return null;
    }
  }

  private async getUserTenantId(userId: UUIDType): Promise<UUIDType> {
    const [user] = await this.dbAdmin
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) throw new Error(`Cannot resolve tenant for user ${userId}`);
    return user.tenantId;
  }

  private async getCourseTenantId(courseId: UUIDType): Promise<UUIDType> {
    const [course] = await this.dbAdmin
      .select({ tenantId: courses.tenantId })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) throw new Error(`Cannot resolve tenant for course ${courseId}`);
    return course.tenantId;
  }

  private async getLastCompletedStudentForCourse(courseId: UUIDType) {
    const [student] = await this.dbAdmin
      .select({
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(studentCourses)
      .innerJoin(users, eq(users.id, studentCourses.studentId))
      .where(and(eq(studentCourses.courseId, courseId), isNotNull(studentCourses.completedAt)))
      .orderBy(desc(studentCourses.completedAt))
      .limit(1);

    return student ?? null;
  }
}
