import { AUTOMATION_EVENT_KINDS } from "@repo/shared";
import {
  AtSign,
  BadgeAlert,
  BadgeX,
  BellRing,
  BookCheck,
  BookOpen,
  CalendarClock,
  CalendarX,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Hand,
  Hourglass,
  KeyRound,
  Link,
  LockKeyhole,
  LogIn,
  Mail,
  Megaphone,
  UserCheck,
  UserPlus,
  Video,
  VideoOff,
  Zap,
} from "lucide-react";

import type { AutomationEventKind } from "@repo/shared";
import type { LucideIcon } from "lucide-react";

const TRIGGER_ICONS: Record<AutomationEventKind, LucideIcon> = {
  [AUTOMATION_EVENT_KINDS.WELCOME]: Hand,
  [AUTOMATION_EVENT_KINDS.PASSWORD_RECOVERY]: LockKeyhole,
  [AUTOMATION_EVENT_KINDS.PASSWORD_REMINDER]: KeyRound,
  [AUTOMATION_EVENT_KINDS.USER_INVITE]: UserPlus,
  [AUTOMATION_EVENT_KINDS.USER_FIRST_LOGIN]: LogIn,
  [AUTOMATION_EVENT_KINDS.USER_ASSIGNED_TO_COURSE]: BookOpen,
  [AUTOMATION_EVENT_KINDS.USER_SHORT_INACTIVITY]: Clock,
  [AUTOMATION_EVENT_KINDS.USER_LONG_INACTIVITY]: Hourglass,
  [AUTOMATION_EVENT_KINDS.USER_FINISHED_CHAPTER]: BookCheck,
  [AUTOMATION_EVENT_KINDS.USER_FINISHED_COURSE]: GraduationCap,
  [AUTOMATION_EVENT_KINDS.CERTIFICATE_EXPIRATION_WARNING]: BadgeAlert,
  [AUTOMATION_EVENT_KINDS.CERTIFICATE_EXPIRED]: BadgeX,
  [AUTOMATION_EVENT_KINDS.ADMIN_NEW_USER]: UserCheck,
  [AUTOMATION_EVENT_KINDS.ADMIN_FINISHED_COURSE]: ClipboardCheck,
  [AUTOMATION_EVENT_KINDS.ADMIN_OVERDUE_COURSES]: CalendarX,
  [AUTOMATION_EVENT_KINDS.MAGIC_LINK]: Link,
  [AUTOMATION_EVENT_KINDS.LIVE_TRAINING_STARTED]: Video,
  [AUTOMATION_EVENT_KINDS.LIVE_TRAINING_REMINDER]: BellRing,
  [AUTOMATION_EVENT_KINDS.LIVE_TRAINING_ENDED]: VideoOff,
  [AUTOMATION_EVENT_KINDS.COURSE_DUE_DATE_REMINDER]: CalendarClock,
  [AUTOMATION_EVENT_KINDS.COURSE_CHAT_MENTION]: AtSign,
  [AUTOMATION_EVENT_KINDS.ANNOUNCEMENT]: Megaphone,
};

export function AutomationNodeIcon({ eventKind }: { eventKind?: AutomationEventKind | null }) {
  const Icon = eventKind ? (TRIGGER_ICONS[eventKind] ?? Zap) : Mail;

  return <Icon className="size-4" aria-hidden="true" />;
}
