import { Link } from "@remix-run/react";
import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";

import type { LucideIcon } from "lucide-react";

type CourseTypeCardProps = {
  title: string;
  description: string;
  features: string[];
  href: string;
  icon: LucideIcon;
  badge?: string;
  accent: "standard" | "scorm";
  testId?: string;
};

const accentClassNames = {
  standard: {
    icon: "border-primary-100 bg-primary-50 text-primary-800 group-hover:border-primary-200",
    card: "hover:border-primary-300 hover:bg-primary-50/40",
    arrow: "text-primary-800",
  },
  scorm: {
    icon: "border-emerald-100 bg-emerald-50 text-emerald-700 group-hover:border-emerald-200",
    card: "hover:border-emerald-300 hover:bg-emerald-50/40",
    arrow: "text-emerald-700",
  },
} as const;

export const CourseTypeCard = ({
  title,
  description,
  features,
  href,
  icon: Icon,
  badge,
  accent,
  testId,
}: CourseTypeCardProps) => {
  const classes = accentClassNames[accent];

  return (
    <Link to={href} data-testid={testId} className="group block h-full focus:outline-none">
      <Card
        className={cn(
          "flex h-full min-h-[340px] flex-col border-neutral-200 bg-white shadow-none transition-colors duration-200 focus-within:ring-2 focus-within:ring-primary-800 group-focus-visible:ring-2 group-focus-visible:ring-primary-800",
          classes.card,
        )}
      >
        <CardHeader className="gap-5 p-8 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div
              className={cn(
                "flex size-14 items-center justify-center rounded-lg border",
                classes.icon,
              )}
            >
              <Icon className="size-7" aria-hidden="true" />
            </div>
            {badge ? (
              <span className="details-md rounded-full border border-neutral-200 px-3 py-1 text-neutral-700">
                {badge}
              </span>
            ) : null}
          </div>
          <div className="space-y-2">
            <CardTitle className="h4 text-neutral-950">{title}</CardTitle>
            <p className="body-base text-neutral-700">{description}</p>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col justify-between gap-8 p-8 pt-2">
          <ul className="grid gap-3">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-neutral-800">
                <span className={cn("mt-2 size-1.5 rounded-full", classes.arrow)} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <div className={cn("flex items-center gap-2 body-base-md", classes.arrow)}>
            <span>{title}</span>
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
