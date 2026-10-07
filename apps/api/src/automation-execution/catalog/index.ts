import { adminFinishedCourseAutomation } from "./admin-finished-course.automation";
import { adminNewUserAutomation } from "./admin-new-user.automation";
import { adminOverdueCoursesAutomation } from "./admin-overdue-courses.automation";
import { announcementAutomation } from "./announcement.automation";
import { certificateExpirationWarningAutomation } from "./certificate-expiration-warning.automation";
import { certificateExpiredAutomation } from "./certificate-expired.automation";
import { courseChatMentionAutomation } from "./course-chat-mention.automation";
import { courseDueDateReminderAutomation } from "./course-due-date-reminder.automation";
import { liveTrainingEndedAutomation } from "./live-training-ended.automation";
import { liveTrainingReminderAutomation } from "./live-training-reminder.automation";
import { liveTrainingStartedAutomation } from "./live-training-started.automation";
import { magicLinkAutomation } from "./magic-link.automation";
import { passwordRecoveryAutomation } from "./password-recovery.automation";
import { passwordReminderAutomation } from "./password-reminder.automation";
import { userAssignedToCourseAutomation } from "./user-assigned-to-course.automation";
import { userFinishedChapterAutomation } from "./user-finished-chapter.automation";
import { userFinishedCourseAutomation } from "./user-finished-course.automation";
import { userFirstLoginAutomation } from "./user-first-login.automation";
import { userInviteAutomation } from "./user-invite.automation";
import { userLongInactivityAutomation } from "./user-long-inactivity.automation";
import { userShortInactivityAutomation } from "./user-short-inactivity.automation";
import { welcomeAutomation } from "./welcome.automation";

export const BUILT_IN_AUTOMATIONS = [
  welcomeAutomation,
  passwordRecoveryAutomation,
  passwordReminderAutomation,
  userInviteAutomation,
  userFirstLoginAutomation,
  userAssignedToCourseAutomation,
  userShortInactivityAutomation,
  userLongInactivityAutomation,
  userFinishedChapterAutomation,
  userFinishedCourseAutomation,
  certificateExpirationWarningAutomation,
  certificateExpiredAutomation,
  adminNewUserAutomation,
  adminFinishedCourseAutomation,
  adminOverdueCoursesAutomation,
  courseDueDateReminderAutomation,
  magicLinkAutomation,
  courseChatMentionAutomation,
  announcementAutomation,
  liveTrainingStartedAutomation,
  liveTrainingReminderAutomation,
  liveTrainingEndedAutomation,
];
