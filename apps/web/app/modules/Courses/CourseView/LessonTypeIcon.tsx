import { Users } from "lucide-react";

import { Icon } from "~/components/Icon";

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
  content: {
    kind: "svg",
    name: "Content",
  },
  quiz: {
    kind: "svg",
    name: "Quiz",
  },
  ai_mentor: {
    kind: "svg",
    name: "AiMentor",
  },
  embed: {
    kind: "svg",
    name: "Embed",
  },
  scorm: {
    kind: "svg",
    name: "Archive",
  },
  live_training: {
    kind: "lucide",
    Icon: Users,
  },
} as const satisfies Record<string, LessonTypeIconConfig>;

type LessonTypeIconProps = {
  type: keyof typeof lessonTypeIconConfig;
  className?: string;
} & Omit<ComponentProps<typeof Icon>, "name" | "className">;

export function LessonTypeIcon({ type, className, ...props }: LessonTypeIconProps) {
  const config = lessonTypeIconConfig[type];

  if (config.kind === "lucide") {
    return <config.Icon className={className} aria-hidden="true" {...props} />;
  }

  return <Icon name={config.name} className={className} {...props} />;
}
