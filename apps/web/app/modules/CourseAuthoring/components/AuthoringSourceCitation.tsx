/** Renders web sources as favicon chips with a lazily loaded metadata popover. */
import { ExternalLink, Globe } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCourseAuthoringLinkPreviewQuery } from "~/api/queries/useCourseAuthoringLinkPreviewQuery";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

import { safeHttpUrl, sourceDomain, type AuthoringSourceLink } from "../authoringSources";

const defaultFaviconUrl = (url: string) => {
  try {
    return new URL("/favicon.ico", url).toString();
  } catch {
    return null;
  }
};

/** Shows a site icon, falling back to a globe when the icon cannot load. */
const SourceFavicon = ({ src, className }: { src: string | null; className?: string }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <Globe
        aria-hidden="true"
        className={cn("shrink-0 text-neutral-400", className)}
        data-testid="authoring-source-favicon-fallback"
      />
    );
  }

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn("shrink-0 rounded-sm object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
};

type ChipProps = {
  source: AuthoringSourceLink;
  className?: string;
};

/** A compact source citation: favicon + domain, opening title, description and URL on click. */
export const AuthoringSourceChip = ({ source, className }: ChipProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const url = safeHttpUrl(source.url);
  const { data: preview, isLoading } = useCourseAuthoringLinkPreviewQuery(url ?? "", open);

  if (!url) return null;

  const domain = preview?.domain ?? sourceDomain(url);
  const title = preview?.title ?? source.label ?? domain;
  const faviconUrl = safeHttpUrl(preview?.faviconUrl) ?? defaultFaviconUrl(url);
  const imageUrl = safeHttpUrl(preview?.imageUrl);
  const siteName = preview?.siteName ?? domain;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("courseAuthoring.sources.citation.openDetails", { title, domain })}
          data-testid="authoring-source-chip"
          data-vaul-no-drag
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            "mx-0.5 inline-flex max-w-44 items-center gap-1 rounded-full border border-neutral-200 bg-white px-1.5 py-0.5 align-middle text-[11px] font-medium leading-4 text-neutral-600 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 data-[state=open]:border-primary-300 data-[state=open]:bg-primary-50",
            className,
          )}
        >
          <SourceFavicon src={faviconUrl} className="size-3.5" />
          <span className="truncate">{domain}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="pointer-events-auto z-[70] w-80 overflow-hidden p-0"
        data-testid="authoring-source-popover"
        data-course-authoring-popup
        data-vaul-no-drag
        // The popover is portalled but React events still bubble to the drawer, whose drag
        // handling captures the pointer and closes the popover before the link can open.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            loading="lazy"
            referrerPolicy="no-referrer"
            className="aspect-[1.91/1] w-full border-b border-neutral-100 bg-neutral-50 object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        )}
        <div className="space-y-2 p-3">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <SourceFavicon src={faviconUrl} className="size-4" />
            <span className="truncate">{siteName}</span>
          </div>
          <p className="line-clamp-2 text-sm font-semibold leading-5 text-neutral-950">{title}</p>
          {isLoading ? (
            <div className="space-y-1.5" aria-busy="true">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          ) : (
            <p className="line-clamp-4 text-xs leading-5 text-neutral-600">
              {preview?.description ?? t("courseAuthoring.sources.citation.noDescription")}
            </p>
          )}
          <p className="truncate text-[11px] text-neutral-400" title={url}>
            {url}
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-700 hover:text-primary-900 hover:underline"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            {t("courseAuthoring.sources.citation.open")}
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/** A single row of source chips placed under the assistant text they support. */
export const AuthoringSourceChipRow = ({ sources }: { sources: AuthoringSourceLink[] }) => {
  const { t } = useTranslation();
  if (sources.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1 pt-1"
      role="list"
      aria-label={t("courseAuthoring.sources.label")}
      data-testid="authoring-source-row"
    >
      <span className="mr-0.5 text-[11px] font-medium text-neutral-500">
        {t("courseAuthoring.sources.label")}
      </span>
      {sources.map((source) => (
        <span role="listitem" key={source.url}>
          <AuthoringSourceChip source={source} className="mx-0" />
        </span>
      ))}
    </div>
  );
};

/** Markdown link renderer: web links become citations, keeping any descriptive link text. */
export const AuthoringMarkdownLink = ({
  href,
  children,
}: {
  href?: string;
  children?: ReactNode;
}) => {
  const url = safeHttpUrl(href);
  if (!url) {
    return (
      <a className="text-primary underline" href={href}>
        {children}
      </a>
    );
  }

  const text = typeof children === "string" ? children : null;
  const isBareUrl =
    text !== null &&
    (text === href || text === url || text.replace(/^https?:\/\//, "") === sourceDomain(url));
  return (
    <>
      {!isBareUrl && children}
      <AuthoringSourceChip source={{ url, label: text && !isBareUrl ? text : null }} />
    </>
  );
};
