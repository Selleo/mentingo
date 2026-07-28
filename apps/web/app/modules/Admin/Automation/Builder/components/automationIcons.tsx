import { STEP_DEFINITIONS } from "@repo/shared";
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
 * Maps icon slug (from step definition `icon` field) to its React element.
 */
const ICON_SLUG_MAP: Record<string, ReactNode> = {
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
};

/**
 * Unified icon map keyed by BOTH icon slug (for sidebar/picker)
 * and node type (for canvas nodes). Derived from the shared STEP_DEFINITIONS
 * so new node types are automatically included.
 */
export const BLOCK_ICON_MAP: Record<string, ReactNode> = {
  // Base icon slug entries
  ...ICON_SLUG_MAP,

  // Derive node-type entries from shared definitions
  ...Object.fromEntries(STEP_DEFINITIONS.map((def) => [def.type, ICON_SLUG_MAP[def.icon]])),
};
