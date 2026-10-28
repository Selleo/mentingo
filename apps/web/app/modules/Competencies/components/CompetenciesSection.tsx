import { useId } from "react";

import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

export function CompetenciesSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();

  return (
    <Card role="region" aria-labelledby={titleId} className={cn("min-w-0", className)}>
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="min-w-0 space-y-1">
          <h2 id={titleId} className="text-lg font-semibold text-primary-950">
            {title}
          </h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
