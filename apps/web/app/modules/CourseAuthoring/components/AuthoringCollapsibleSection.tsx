/** Collapsible transcript section with a chevron header, used for live work and plans. */
import { ChevronRight } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { cn } from "~/lib/utils";

type Props = {
  title: string;
  icon?: ReactNode;
  detail?: ReactNode;
  summary?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
  testId?: string;
  tone?: "neutral" | "success" | "danger";
  progress?: ReactNode;
};

/** Follows `defaultOpen` until the author toggles it, so running work can auto-collapse when done. */
export const AuthoringCollapsibleSection = ({
  title,
  icon,
  detail,
  summary,
  defaultOpen = false,
  children,
  className,
  testId,
  tone = "neutral",
  progress,
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
        className="flex min-h-8 w-full items-center gap-1.5 rounded-md px-1 text-left text-xs text-neutral-600 hover:bg-neutral-100"
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-neutral-500 transition-transform motion-reduce:transition-none",
            open && "rotate-90",
          )}
          aria-hidden="true"
        />
        {icon && (
          <span className="flex shrink-0 items-center" aria-hidden="true">
            {icon}
          </span>
        )}
        <span className="shrink-0 font-semibold text-neutral-800">{title}</span>
        {detail && <span className="min-w-0 flex-1 truncate text-neutral-600">{detail}</span>}
        {summary && (
          <span
            className={cn(
              "ml-auto shrink-0 truncate pl-3 tabular-nums",
              tone === "success" && "font-medium text-success-700",
              tone === "danger" && "font-medium text-error-700",
            )}
          >
            {summary}
          </span>
        )}
      </button>
      {progress && <div className="pb-1 pl-[26px] pr-1">{progress}</div>}
      {open && (
        <div id={contentId} className="ml-[11px] border-l border-neutral-200 pl-3 pt-1">
          {children}
        </div>
      )}
    </section>
  );
};
