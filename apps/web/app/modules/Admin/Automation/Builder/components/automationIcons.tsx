import { AlertTriangle, Award, CalendarClock, CircleX, Mail, UserPlus, Video } from "lucide-react";

import type { ReactNode } from "react";

/**
 * Shared icon map for automation blocks.
 * Keyed by the `icon` field from step definitions (sidebar) and by `type` (canvas).
 */
export const BLOCK_ICON_MAP: Record<string, ReactNode> = {
  // By icon slug (used in sidebar/picker)
  "calendar-clock": <CalendarClock className="size-4" />,
  "alert-triangle": <AlertTriangle className="size-4" />,
  "circle-x": <CircleX className="size-4" />,
  "user-plus": <UserPlus className="size-4" />,
  award: <Award className="size-4" />,
  video: <Video className="size-4" />,
  mail: <Mail className="size-4" />,

  // By node type (used in canvas)
  course_deadline: <CalendarClock className="size-4" />,
  overdue: <AlertTriangle className="size-4" />,
  not_completed: <CircleX className="size-4" />,
  user_enrolled: <UserPlus className="size-4" />,
  certificate_expiring_soon: <Award className="size-4" />,
  live_transmission_starting_soon: <Video className="size-4" />,
  send_email: <Mail className="size-4" />,
};
