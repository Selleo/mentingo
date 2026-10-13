/** Collapsible transcript section with a chevron header, used for live work and plans. */
import { ChevronRight } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { cn } from "~/lib/utils";

type Props = {
  title: string;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  testId?: string;
};

/** Follows `defaultOpen` until the author toggles it, so running work can auto-collapse when done. */
export const AuthoringCollapsibleSection = ({
  title,
  summary,
  defaultOpen = false,
  children,
  className,
  testId,
}: Props) => {
  const contentId = useId();
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? defaultOpen;

  return (
    <section aria-label={title} className={cn("max-w-xl", className)} data-testid={testId}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setUserOpen(!open)}
        className="flex min-h-7 w-full items-center gap-1.5 rounded-md px-1 text-left text-xs text-neutral-600 hover:bg-neutral-100"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-neutral-500 transition-transform motion-reduce:transition-none",
            open && "rotate-90",
          )}
          aria-hidden="true"
        />
        <span className="font-semibold text-neutral-800">{title}</span>
        {summary && <span className="ml-auto truncate pl-3">{summary}</span>}
      </button>
      {open && (
        <div id={contentId} className="pl-5 pt-1">
          {children}
        </div>
      )}
    </section>
  );
};
