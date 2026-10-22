import { CornerDownLeft, Sparkles } from "lucide-react";

import { cn } from "~/lib/utils";

type GlobalSearchAskAiRowProps = {
  title: string;
  query: string;
  isActive: boolean;
  onClick: () => void;
};

/**
 * "Search with AI" as a slim row pinned under the input, as in Raycast or Notion: the AI path sits
 * where the eye already is. It is highlighted when Enter would run it, so an AI request is always
 * a visible, explicit choice and never a side effect of typing.
 */
export const GlobalSearchAskAiRow = ({
  title,
  query,
  isActive,
  onClick,
}: GlobalSearchAskAiRowProps) => (
  <button
    type="button"
    data-testid="global-search-ask-ai"
    aria-label={`${title}: “${query}”`}
    aria-keyshortcuts="Meta+Enter Control+Enter"
    aria-current={isActive || undefined}
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-start outline-none transition-colors hover:bg-neutral-50 focus-visible:bg-primary-50",
      isActive && "bg-primary-50 hover:bg-primary-50",
    )}
  >
    <span className="flex size-5 shrink-0 items-center justify-center text-primary-600">
      <Sparkles className="size-4" strokeWidth={1.75} aria-hidden />
    </span>
    <span className="shrink-0 body-sm-md text-neutral-950">{title}</span>
    <span className="min-w-0 flex-1 truncate details text-neutral-600">“{query}”</span>
    <CornerDownLeft
      className={cn("size-4 shrink-0 text-neutral-500", !isActive && "invisible")}
      aria-hidden
    />
  </button>
);
