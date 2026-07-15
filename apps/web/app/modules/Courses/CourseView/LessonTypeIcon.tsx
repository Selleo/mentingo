import { LESSON_TYPES } from "@repo/shared";
import { Users } from "lucide-react";

import { Icon } from "~/components/Icon";

import type { LessonTypes } from "@repo/shared";
import type { LucideIcon } from "lucide-react";
import type { ComponentProps } from "react";
import type { IconName } from "~/types/shared";

type LessonTypeIconConfig =
  | {
      kind: "svg";
      name: IconName;
    }
  | {
      kind: "lucide";
      Icon: LucideIcon;
    };

const lessonTypeIconConfig = {
  [LESSON_TYPES.CONTENT]: {
    kind: "svg",
    name: "Content",
  },
  [LESSON_TYPES.QUIZ]: {
    kind: "svg",
    name: "Quiz",
  },
  [LESSON_TYPES.AI_MENTOR]: {
    kind: "svg",
    name: "AiMentor",
  },
  [LESSON_TYPES.EMBED]: {
    kind: "svg",
    name: "Embed",
  },
  [LESSON_TYPES.SCORM]: {
    kind: "svg",
    name: "Archive",
  },
  [LESSON_TYPES.LIVE_TRAINING]: {
    kind: "lucide",
    Icon: Users,
  },
} as const satisfies Record<LessonTypes, LessonTypeIconConfig>;

type LessonTypeIconProps = {
  type: LessonTypes;
  className?: string;
} & Omit<ComponentProps<typeof Icon>, "name" | "className">;

export function LessonTypeIcon({ type, className, ...props }: LessonTypeIconProps) {
  const config = lessonTypeIconConfig[type];

  if (config.kind === "lucide") {
    return <config.Icon className={className} aria-hidden="true" {...props} />;
  }

  return <Icon name={config.name} className={className} {...props} />;
}
