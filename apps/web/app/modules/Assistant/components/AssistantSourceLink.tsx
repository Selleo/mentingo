import { Anchor } from "@radix-ui/react-popover";
import { Link } from "@remix-run/react";
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  FolderOpen,
  GraduationCap,
  Layers,
  Link2,
  CircleHelp,
  MessageCircleQuestion,
  Newspaper,
  Tag,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Popover, PopoverContent } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

import type { AssistantSource } from "../assistant.types";

const sourceIcons = {
  course: GraduationCap,
  lesson: BookOpen,
  user: UserRound,
  group: Users,
  category: Tag,
  article: FileText,
  news: Newspaper,
  qa: MessageCircleQuestion,
  development_path: Layers,
  resource: FolderOpen,
  helpdesk: CircleHelp,
};

/** Uses only metadata already returned by an authorized Assistant read. */
export function AssistantSourceLink({
  source,
  children,
  className,
  testId,
}: {
  source: AssistantSource;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const previewId = useId();
  const trigger = useRef<HTMLAnchorElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const action = useRef<HTMLAnchorElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout>>();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };
  useEffect(() => () => clearTimers(), []);
  const openPreview = () => {
    clearTimers();
    setOpen(true);
  };
  const leavePreview = () => {
    clearTimers();
    closeTimer.current = setTimeout(() => {
      if (
        trigger.current === document.activeElement ||
        preview.current?.contains(document.activeElement)
      )
        return;
      setOpen(false);
    }, 350);
  };
  const closeOnBlur = (target: EventTarget | null) => {
    if (
      target instanceof Node &&
      (trigger.current?.contains(target) || preview.current?.contains(target))
    )
      return;
    setOpen(false);
  };
  const url = new URL(source.url, "https://assistant.invalid");
  const destination = `${url.pathname}${url.search}${url.hash}`;
  const SourceIcon = source.entityType ? (sourceIcons[source.entityType] ?? Link2) : Link2;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Anchor asChild>
        <Link
          ref={trigger}
          to={destination}
          data-testid={testId}
          aria-controls={open ? previewId : undefined}
          aria-expanded={open}
          aria-haspopup="dialog"
          onPointerEnter={(event) => {
            if (event.pointerType === "touch") return;
            clearTimers();
            openTimer.current = setTimeout(openPreview, 300);
          }}
          onPointerLeave={leavePreview}
          onFocus={openPreview}
          onBlur={(event) => closeOnBlur(event.relatedTarget)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              clearTimers();
              setOpen(false);
            }
            if (event.key === "Tab" && !event.shiftKey && open && action.current) {
              event.preventDefault();
              action.current.focus();
            }
          }}
          className={cn(
            "rounded-sm text-primary-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300",
            className,
          )}
        >
          {children}
        </Link>
      </Anchor>
      <PopoverContent
        ref={preview}
        id={previewId}
        role="dialog"
        aria-label={source.title}
        onPointerEnter={openPreview}
        onPointerLeave={leavePreview}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => {
          if (event.target instanceof Node && trigger.current?.contains(event.target))
            event.preventDefault();
        }}
        onFocusCapture={openPreview}
        onBlurCapture={(event) => closeOnBlur(event.relatedTarget)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            trigger.current?.focus();
            setOpen(false);
          }
        }}
        align="start"
        side="top"
        sideOffset={8}
        collisionPadding={12}
        className="z-[70] w-80 p-0 max-w-[calc(100vw-24px)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
      >
        <div className="flex items-start gap-3 p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300">
            <SourceIcon className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {t(`assistant.sourceTypes.${source.entityType ?? "reference"}`)}
            </p>
            <p className="break-words text-sm font-semibold leading-5">{source.title}</p>
            {source.description && (
              <p className="line-clamp-3 break-words text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                {source.description}
              </p>
            )}
          </div>
        </div>
        <Link
          ref={action}
          to={destination}
          onKeyDown={(event) => {
            if (event.key === "Tab" && event.shiftKey) {
              event.preventDefault();
              trigger.current?.focus();
            }
          }}
          className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-xs text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 dark:text-primary-300 dark:hover:bg-primary-950"
        >
          <span>{t("assistant.openSource")}</span>
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </PopoverContent>
    </Popover>
  );
}
