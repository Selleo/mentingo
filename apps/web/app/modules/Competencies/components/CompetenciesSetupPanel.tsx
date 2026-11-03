import { useId } from "react";

import { Card } from "~/components/ui/card";

import type { ReactNode } from "react";

type CompetenciesSetupPanelProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function CompetenciesSetupPanel({
  title,
  description,
  children,
}: CompetenciesSetupPanelProps) {
  const titleId = useId();
  return (
    <Card role="region" aria-labelledby={titleId} className="min-w-0 overflow-hidden">
      <header className="space-y-1 px-6 pt-6">
        <h2 id={titleId} className="h6 text-neutral-950">
          {title}
        </h2>
        <p className="body-sm max-w-3xl text-neutral-800">{description}</p>
      </header>
      {children}
    </Card>
  );
}
