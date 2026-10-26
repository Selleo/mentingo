import { Link } from "@remix-run/react";
import { Paperclip } from "lucide-react";

import type { ComponentProps, ReactNode } from "react";

/** Props every result entry receives; the list owns the type label and keyboard selection. */
export type GlobalSearchEntryProps<TItem> = {
  item: TItem;
  onSelect: () => void;
  /** Omitted when a section heading already names the kind. */
  typeLabel?: string;
  isActive: boolean;
  showPassage: boolean;
};

type GlobalSearchResultRowProps = {
  to: ComponentProps<typeof Link>["to"];
  onSelect: () => void;
  leading: ReactNode;
  title: string;
  typeLabel?: string;
  meta?: ReactNode;
  isActive: boolean;
  matchedAttachmentFileName?: string | null;
  matchedPassage?: string;
  showPassage: boolean;
};

/**
 * One relevance-ordered result on a single line: type icon, title, and right-aligned context and
 * type. A second line appears only when the attachment name or excerpt explains why it ranked.
 * Passages render as plain text, never as HTML.
 */
export const GlobalSearchResultRow = ({
  to,
  onSelect,
  leading,
  title,
  typeLabel,
  meta,
  isActive,
  matchedAttachmentFileName,
  matchedPassage,
  showPassage,
}: GlobalSearchResultRowProps) => {
  const showEvidence = !!matchedAttachmentFileName || (showPassage && !!matchedPassage);

  return (
    <Link
      to={to}
      onClick={onSelect}
      aria-current={isActive || undefined}
      className="flex items-start gap-2.5 rounded-md px-2.5 py-1.5 outline-none hover:bg-neutral-50 focus-visible:bg-primary-50"
    >
      <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded text-neutral-500">
        {leading}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-3">
          <span className="min-w-0 flex-1 truncate body-sm-md text-neutral-950">{title}</span>
          <span className="flex min-w-0 max-w-[45%] items-center justify-end gap-1.5 overflow-hidden whitespace-nowrap details text-neutral-500">
            {meta && (
              <>
                <span className="min-w-0 truncate [&>svg]:mr-1 [&>svg]:inline [&>svg]:align-[-2px]">
                  {meta}
                </span>
                {typeLabel && (
                  <span aria-hidden className="shrink-0">
                    ·
                  </span>
                )}
              </>
            )}
            {typeLabel && <span className="shrink-0">{typeLabel}</span>}
          </span>
        </span>
        {showEvidence && (
          <span className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-neutral-600">
            {matchedAttachmentFileName && (
              <span className="flex min-w-0 max-w-[50%] items-center gap-1 font-medium text-neutral-700">
                <Paperclip className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{matchedAttachmentFileName}</span>
              </span>
            )}
            {showPassage && matchedPassage && <span className="truncate">{matchedPassage}</span>}
          </span>
        )}
      </span>
    </Link>
  );
};
