import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  /** Page-level actions, such as a create button, aligned to the far right of the title. */
  actions?: ReactNode;
  testId?: string;
  headingTestId?: string;
};

export function PageHeader({ title, actions, testId, headingTestId }: PageHeaderProps) {
  return (
    <header data-testid={testId} className="flex flex-wrap items-center justify-between gap-4">
      <h4 data-testid={headingTestId} className="h4 min-w-0 text-neutral-950">
        {title}
      </h4>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </header>
  );
}
