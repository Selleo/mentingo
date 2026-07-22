import {
  Archive,
  AtSign,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle,
  GraduationCap,
  Key,
  Lock,
  LogIn,
  Mail,
  Megaphone,
  Shield,
  Sparkles,
  Trophy,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";

import type { ReactNode } from "react";

/**
 * Shared icon map for automation blocks.
 * Keyed by the `icon` field from step definitions (sidebar) and by `type` (canvas).
 */
export const BLOCK_ICON_MAP: Record<string, ReactNode> = {
  // By icon slug (used in sidebar/picker)
  "user-plus": <UserPlus className="size-4" />,
  upload: <Upload className="size-4" />,
  key: <Key className="size-4" />,
  lock: <Lock className="size-4" />,
  sparkles: <Sparkles className="size-4" />,
  "log-in": <LogIn className="size-4" />,
  "book-open": <BookOpen className="size-4" />,
  "user-x": <UserX className="size-4" />,
  "check-circle": <CheckCircle className="size-4" />,
  "graduation-cap": <GraduationCap className="size-4" />,
  "user-check": <UserCheck className="size-4" />,
  shield: <Shield className="size-4" />,
  trophy: <Trophy className="size-4" />,
  award: <Award className="size-4" />,
  archive: <Archive className="size-4" />,
  megaphone: <Megaphone className="size-4" />,
  "at-sign": <AtSign className="size-4" />,
  "calendar-clock": <CalendarClock className="size-4" />,
  mail: <Mail className="size-4" />,

  // By node type (used in canvas)
  user_invited: <UserPlus className="size-4" />,
  users_imported_invite: <Upload className="size-4" />,
  user_password_reminder: <Key className="size-4" />,
  user_password_changed: <Lock className="size-4" />,
  user_welcome: <Sparkles className="size-4" />,
  user_first_login: <LogIn className="size-4" />,
  users_assigned_to_course: <BookOpen className="size-4" />,
  users_short_inactivity: <UserX className="size-4" />,
  users_long_inactivity: <UserX className="size-4" />,
  user_chapter_finished: <CheckCircle className="size-4" />,
  user_course_finished: <GraduationCap className="size-4" />,
  user_registered: <UserCheck className="size-4" />,
  user_password_created: <Shield className="size-4" />,
  course_completed: <Trophy className="size-4" />,
  certificate_expiration_warning: <Award className="size-4" />,
  certificate_archived: <Archive className="size-4" />,
  announcement_published: <Megaphone className="size-4" />,
  course_chat_user_mentioned: <AtSign className="size-4" />,
  course_due_date_reminder: <CalendarClock className="size-4" />,
  send_email: <Mail className="size-4" />,
};
