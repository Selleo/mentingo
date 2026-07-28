import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  AnnouncementEmail,
  CertificateExpirationWarningEmail,
  CertificateExpiredEmail,
  CourseDueDateReminderEmail,
  CreatePasswordReminderEmail,
  FinishedCourseEmail,
  NewUserEmail,
  UserAssignedToCourseEmail,
  UserFinishedChapterEmail,
  UserFinishedCourseEmail,
  UserFirstLoginEmail,
  UserInviteEmail,
  UserLongInactivityEmail,
  UserShortInactivityEmail,
  WelcomeEmail,
} from "@repo/email-templates";

import { DatabasePg } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import { resolveTenantOrigin } from "src/common/helpers/resolveTenantOrigin";
import { DB_ADMIN } from "src/storage/db/db.providers";

import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { EmailSubjectKey } from "src/common/emails/translations";

/**
 * System template IDs that are handled by this renderer.
 * Anything NOT in this set is treated as a custom (DB) template.
 */
export const SYSTEM_TEMPLATE_IDS = new Set([
  "user_invite",
  "welcome",
  "user_first_login",
  "user_assigned_to_course",
  "user_short_inactivity",
  "user_long_inactivity",
  "user_finished_chapter",
  "user_finished_course",
  "create_password_reminder",
  "certificate_expiration_warning",
  "certificate_expired",
  "announcement",
  "course_due_date_reminder",
  "new_user",
  "finished_course",
]);

export function isSystemTemplateId(templateId: string): boolean {
  return SYSTEM_TEMPLATE_IDS.has(templateId);
}

/**
 * Result of rendering a system email template with resolved runtime data.
 */
export interface RenderedSystemEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Renders system (hardcoded) email templates from `@repo/email-templates`
 * using actual runtime data from the automation data resolver.
 *
 * This service maps the flat `variables` record (provided by the data resolver)
 * to the typed props each system template requires.
 */
@Injectable()
export class AutomationSystemTemplateRendererService {
  private readonly logger = new Logger(AutomationSystemTemplateRendererService.name);

  constructor(
    private readonly emailService: EmailService,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  /**
   * Renders a system email template with actual runtime data.
   *
   * @param templateId - System template identifier (e.g. "user_invite")
   * @param variables - Flat key→value map from data resolver
   * @param tenantId - Tenant for branding resolution
   * @param userId - Optional user for language/branding resolution
   * @param language - Explicit language override
   */
  async render(
    templateId: string,
    variables: Record<string, string>,
    tenantId: UUIDType,
    userId?: UUIDType,
    language?: SupportedLanguages,
  ): Promise<RenderedSystemEmail | null> {
    const emailSettings = await this.emailService.getDefaultEmailProperties(
      tenantId,
      userId,
      language,
    );

    const origin = await resolveTenantOrigin(this.dbAdmin, tenantId);

    const email = this.buildEmailInstance(templateId, variables, emailSettings, origin);

    if (!email) {
      this.logger.warn(`No system template renderer for: ${templateId}`);
      return null;
    }

    const [text, html] = await Promise.all([email.text, email.html]);

    return {
      subject: this.resolveSubject(templateId, variables, emailSettings.language),
      text,
      html,
    };
  }

  private buildEmailInstance(
    templateId: string,
    vars: Record<string, string>,
    settings: { primaryColor: string; companyName: string; language: SupportedLanguages },
    origin: string,
  ) {
    const base = {
      primaryColor: settings.primaryColor,
      companyName: settings.companyName,
      language: settings.language,
    };

    switch (templateId) {
      case "user_invite":
        return new UserInviteEmail({
          invitedByUserName: vars.invitedByUserName || vars.userFirstName || "Admin",
          createPasswordLink: vars.inviteLink || `${origin}/create-password`,
          ...base,
        });

      case "welcome":
        return new WelcomeEmail({
          coursesLink: vars.platformUrl || `${origin}/courses`,
          ...base,
        });

      case "user_first_login":
        return new UserFirstLoginEmail({
          name: vars.userFirstName || "",
          coursesUrl: vars.platformUrl || `${origin}/courses`,
          ...base,
        });

      case "user_assigned_to_course":
        return new UserAssignedToCourseEmail({
          courseName: vars.courseName || "",
          courseLink: vars.courseUrl || `${origin}/courses`,
          formatedCourseDueDate: vars.dueDate || null,
          ...base,
        });

      case "user_short_inactivity":
        return new UserShortInactivityEmail({
          courseName: vars.courseName || undefined,
          courseLink: vars.courseUrl || `${origin}/courses`,
          ...base,
        });

      case "user_long_inactivity":
        return new UserLongInactivityEmail({
          courseName: vars.courseName || undefined,
          courseLink: vars.courseUrl || `${origin}/courses`,
          ...base,
        });

      case "user_finished_chapter":
        return new UserFinishedChapterEmail({
          chapterName: vars.chapterName || "",
          courseName: vars.courseName || "",
          courseLink: vars.courseUrl || `${origin}/courses`,
          ...base,
        });

      case "user_finished_course":
        return new UserFinishedCourseEmail({
          courseName: vars.courseName || "",
          buttonLink: vars.certificateUrl || vars.courseUrl || `${origin}/courses`,
          hasCertificate: vars.hasCertificate === "true",
          ...base,
        });

      case "create_password_reminder":
        return new CreatePasswordReminderEmail({
          createPasswordLink:
            vars.resetPasswordLink || vars.inviteLink || `${origin}/create-password`,
          ...base,
        });

      case "certificate_expiration_warning":
        return new CertificateExpirationWarningEmail({
          courseName: vars.certificateName || vars.courseName || "",
          courseLink: vars.courseUrl || `${origin}/courses`,
          expiresAt: vars.expirationDate || "",
          ...base,
        });

      case "certificate_expired":
        return new CertificateExpiredEmail({
          courseName: vars.certificateName || vars.courseName || "",
          courseLink: vars.courseUrl || `${origin}/courses`,
          reason: (vars.archiveReason as "expired" | "manual_reset") || "expired",
          ...base,
        });

      case "announcement":
        return new AnnouncementEmail({
          title: vars.announcementTitle || "",
          content: vars.announcementContent || "",
          buttonLink: vars.announcementUrl || `${origin}/announcements`,
          ...base,
        });

      case "course_due_date_reminder":
        return new CourseDueDateReminderEmail({
          courseName: vars.courseName || "",
          courseLink: vars.courseUrl || `${origin}/courses`,
          dueDate: vars.dueDate || "",
          daysBeforeDueDate: parseInt(vars.daysLeft || "7", 10),
          ...base,
        });

      case "new_user":
        return new NewUserEmail({
          userName:
            vars.userName ||
            [vars.userFirstName, vars.userLastName].filter(Boolean).join(" ") ||
            "",
          profileLink: vars.profileLink || `${origin}/admin/users`,
          ...base,
        });

      case "finished_course":
        return new FinishedCourseEmail({
          userName:
            vars.userName ||
            [vars.userFirstName, vars.userLastName].filter(Boolean).join(" ") ||
            "",
          courseName: vars.courseName || "",
          progressLink: vars.progressLink || `${origin}/admin/courses`,
          ...base,
        });

      default:
        return null;
    }
  }

  /**
   * Maps system template IDs to their `getEmailSubject` translation keys
   * and builds the replacement map for dynamic tokens (e.g. `{{courseName}}`).
   */
  private resolveSubject(
    templateId: string,
    vars: Record<string, string>,
    language: SupportedLanguages,
  ): string {
    const mapping = this.getSubjectMapping(templateId, vars);

    if (!mapping) return vars.announcementTitle || "Notification";

    return getEmailSubject(mapping.key, language, mapping.replacements);
  }

  private getSubjectMapping(
    templateId: string,
    vars: Record<string, string>,
  ): { key: EmailSubjectKey; replacements: Record<string, string> } | null {
    switch (templateId) {
      case "user_invite":
        return { key: "userInviteEmail", replacements: {} };
      case "welcome":
        return { key: "welcomeEmail", replacements: {} };
      case "user_first_login":
        return { key: "userFirstLoginEmail", replacements: {} };
      case "user_assigned_to_course":
        return {
          key: "userCourseAssignmentEmail",
          replacements: { courseName: vars.courseName || "" },
        };
      case "user_short_inactivity":
        return vars.courseName
          ? { key: "userShortInactivityEmail", replacements: { courseName: vars.courseName } }
          : { key: "userShortInactivityPlatformEmail", replacements: {} };
      case "user_long_inactivity":
        return { key: "userLongInactivityEmail", replacements: {} };
      case "user_finished_chapter":
        return {
          key: "userChapterFinishedEmail",
          replacements: { chapterName: vars.chapterName || "" },
        };
      case "user_finished_course":
        return {
          key: "userCourseFinishedEmail",
          replacements: { courseName: vars.courseName || "" },
        };
      case "create_password_reminder":
        return { key: "passwordReminderEmail", replacements: {} };
      case "certificate_expiration_warning":
        return {
          key: "certificateExpirationWarningEmail",
          replacements: { courseName: vars.certificateName || vars.courseName || "" },
        };
      case "certificate_expired":
        return {
          key: "certificateExpiredEmail",
          replacements: { courseName: vars.certificateName || vars.courseName || "" },
        };
      case "announcement":
        return null; // Announcement uses title directly as subject
      case "course_due_date_reminder":
        return {
          key: "courseDueDateReminderEmail",
          replacements: { courseName: vars.courseName || "" },
        };
      case "new_user":
        return { key: "adminNewUserEmail", replacements: {} };
      case "finished_course":
        return { key: "adminCourseFinishedEmail", replacements: {} };
      default:
        return null;
    }
  }
}
