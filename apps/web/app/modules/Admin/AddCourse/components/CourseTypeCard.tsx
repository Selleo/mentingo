import { Link } from "@remix-run/react";
import { ChevronRight } from "lucide-react";

import { cn } from "~/lib/utils";

import type { LucideIcon } from "lucide-react";

type CourseTypeCardProps = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  accent: "standard" | "scorm" | "mentingoPackage";
  testId?: string;
};

const accentClassNames = {
  standard: {
    row: "hover:border-primary-500",
    icon: "bg-primary-50 text-primary-800",
  },
  scorm: {
    row: "hover:border-emerald-500",
    icon: "bg-emerald-50 text-emerald-700",
  },
  mentingoPackage: {
    row: "hover:border-sky-500",
    icon: "bg-sky-50 text-sky-700",
  },
} as const;

/** One way to create a course, shown as a selectable row in the course creation flow. */
export const CourseTypeCard = ({
  title,
  description,
  href,
  icon: Icon,
  accent,
  testId,
}: CourseTypeCardProps) => {
  const classes = accentClassNames[accent];

  return (
    <Link
      to={href}
      data-testid={testId}
      className={cn(
        "group flex items-center gap-4 rounded-lg border border-neutral-200 bg-white p-5 transition-colors duration-200 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-800 focus-visible:ring-offset-2",
        classes.row,
      )}
    >
      <div
        className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg", classes.icon)}
      >
        <Icon className="size-6" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="body-base-md text-neutral-950">{title}</h2>
        <p className="body-sm mt-1 text-neutral-700">{description}</p>
      </div>
      <ChevronRight
        className="size-5 shrink-0 text-neutral-400 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-neutral-950"
        aria-hidden="true"
      />
    </Link>
  );
};
