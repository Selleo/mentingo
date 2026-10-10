/** Keeps source authority, uploads, and replacement review behind one compact control. */
import { COURSE_AUTHORING_SOURCE_FILE_TYPES, MAX_COURSE_AUTHORING_SOURCE_SIZE } from "@repo/shared";
import { FileUp, Globe2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";

import { COURSE_AUTHORING_HANDLES } from "../../../../e2e/data/curriculum/handles";

import { SourceRefreshPanel } from "./SourceRefreshPanel";

import type { SourcePolicy, SourceRefreshView, SourceView } from "../courseAuthoring.types";

type Props = {
  sources: SourceView[];
  policy: SourcePolicy;
  disabled?: boolean;
  open?: boolean;
  validationError?: string;
  sourceUploadError: string | null;
  isUploadingSource?: boolean;
  uploadingSourceName?: string;
  sourceRefreshes: SourceRefreshView[];
  onOpenChange?: (open: boolean) => void;
  onPolicyChange: (policy: SourcePolicy) => void;
  onSourceUploadError?: (error: string | null) => void;
  onUploadSource?: (file: File) => void;
  onRefreshSource?: (
    oldSourceVersionId: string,
    replacementSourceVersionId: string,
    sourcePolicy?: SourcePolicy,
  ) => void;
};

const AUTHORING_SOURCE_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"] as const;
const AUTHORING_SOURCE_ACCEPT = [
  ...COURSE_AUTHORING_SOURCE_FILE_TYPES,
  ...AUTHORING_SOURCE_EXTENSIONS,
].join(",");

/** Returns a translation key so source validation follows the current interface language. */
export const getCourseAuthoringSourceError = (file: File): string | null => {
  if (file.size > MAX_COURSE_AUTHORING_SOURCE_SIZE) return "courseAuthoring.sources.tooLarge";
  const lowerName = file.name.toLowerCase();
  const permittedMime = COURSE_AUTHORING_SOURCE_FILE_TYPES.some((type) => type === file.type);
  const permittedExtension = AUTHORING_SOURCE_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension),
  );
  return permittedMime || permittedExtension ? null : "courseAuthoring.sources.unsupportedFile";
};

/** Renders explicit source permissions and maps durable section refreshes without changing selection silently. */
export const AuthoringSourcePopover = ({
  sources,
  policy,
  disabled,
  open,
  validationError,
  sourceUploadError,
  isUploadingSource = false,
  uploadingSourceName,
  sourceRefreshes,
  onOpenChange,
  onPolicyChange,
  onSourceUploadError,
  onUploadSource,
  onRefreshSource,
}: Props) => {
  const { t } = useTranslation();
  const [disconnectedSourceIds, setDisconnectedSourceIds] = useState<Set<string>>(() => new Set());
  const validationRef = useRef<HTMLParagraphElement>(null);
  const popupListenerRef = useRef<{
    element: HTMLDivElement;
    listener: () => void;
  } | null>(null);
  const sourceAuthorityCount =
    policy.sourceVersionIds.length +
    Number(policy.webEnabled) +
    Number(policy.generalKnowledgeEnabled);
  const authorityLabels = [
    policy.sourceVersionIds.length > 0 ? t("courseAuthoring.sources.library") : null,
    policy.webEnabled ? t("courseAuthoring.sources.web") : null,
    policy.generalKnowledgeEnabled ? t("courseAuthoring.sources.general") : null,
  ].filter((label): label is string => label !== null);
  const visibleSources = sources.filter((source) => !disconnectedSourceIds.has(source.id));

  useEffect(() => {
    if (open && validationError) validationRef.current?.focus();
  }, [open, validationError]);

  /** Registers on the portalled node as soon as it mounts so the drawer can delegate Escape. */
  const setPopupRef = useCallback(
    (element: HTMLDivElement | null) => {
      const previous = popupListenerRef.current;
      previous?.element.removeEventListener("course-authoring-popup-escape", previous.listener);
      popupListenerRef.current = null;
      if (!element) return;
      const listener = () => onOpenChange?.(false);
      element.addEventListener("course-authoring-popup-escape", listener);
      popupListenerRef.current = { element, listener };
    },
    [onOpenChange],
  );

  useEffect(
    () => () => {
      const previous = popupListenerRef.current;
      previous?.element.removeEventListener("course-authoring-popup-escape", previous.listener);
      popupListenerRef.current = null;
    },
    [],
  );

  /** Updates one policy field and informs the session owner immediately. */
  const updatePolicy = (next: SourcePolicy) => onPolicyChange(next);

  /** Uploads a valid file and clears the native file input for repeat selection. */
  const handleFileChange = (file: File | undefined, reset: () => void) => {
    if (file) {
      const error = getCourseAuthoringSourceError(file);
      onSourceUploadError?.(error);
      if (!error) onUploadSource?.(file);
    }
    reset();
  };

  return (
    <Popover modal={false} open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-neutral-200 bg-white text-neutral-700 shadow-none hover:bg-primary-50 hover:text-primary-800"
          disabled={disabled}
          data-vaul-no-drag
          data-testid={COURSE_AUTHORING_HANDLES.SOURCES_TRIGGER}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Icon name="Library" className="size-3.5" aria-hidden="true" />
          {t("courseAuthoring.sources.label")}
          {sourceAuthorityCount > 0 && (
            <span
              className="text-xs text-neutral-500"
              aria-label={t("courseAuthoring.sources.selectedAuthority", {
                value: authorityLabels.join(", "),
              })}
            >
              {authorityLabels.join(", ")}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="scrollbar-hide pointer-events-auto z-[70] max-h-[calc(100dvh-6rem)] w-[min(30rem,calc(100vw-2rem))] space-y-4 overflow-y-auto border-neutral-200 bg-white p-3 shadow-xl"
        ref={setPopupRef}
        data-course-authoring-popup
        data-vaul-no-drag
        onEscapeKeyDown={(event) => {
          if (event.target instanceof Element && event.target.closest('[role="listbox"]')) {
            event.preventDefault();
          }
          event.stopPropagation();
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <div>
          <p className="text-sm font-semibold text-neutral-900">
            {t("courseAuthoring.sources.label")}
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-600">
            {t("courseAuthoring.sources.description")}
          </p>
        </div>
        {validationError && (
          <p
            ref={validationRef}
            role="alert"
            tabIndex={-1}
            aria-label={validationError}
            className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950"
          >
            {validationError}
          </p>
        )}
        <div className="space-y-3 rounded-lg bg-neutral-50 p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              <Globe2 className="mr-2 inline size-4" />
              {t("courseAuthoring.sources.web")}
            </span>
            <Switch
              aria-label={t("courseAuthoring.sources.web")}
              checked={policy.webEnabled}
              onCheckedChange={(webEnabled) => updatePolicy({ ...policy, webEnabled })}
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>{t("courseAuthoring.sources.general")}</span>
            <Switch
              aria-label={t("courseAuthoring.sources.general")}
              checked={policy.generalKnowledgeEnabled}
              onCheckedChange={(generalKnowledgeEnabled) =>
                updatePolicy({ ...policy, generalKnowledgeEnabled })
              }
              disabled={disabled}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label>{t("courseAuthoring.sources.library")}</Label>
            {onUploadSource && (
              <label className="cursor-pointer text-xs font-medium text-primary-800">
                <FileUp className="mr-1 inline size-3.5" />
                {t("courseAuthoring.sources.upload")}
                <input
                  type="file"
                  className="sr-only"
                  accept={AUTHORING_SOURCE_ACCEPT}
                  disabled={disabled}
                  onChange={(event) =>
                    handleFileChange(event.target.files?.[0], () => {
                      event.currentTarget.value = "";
                    })
                  }
                />
              </label>
            )}
          </div>
          <p className="mt-1 text-[11px] text-neutral-500">
            {t("courseAuthoring.sources.fileHint")}
          </p>
          {sourceUploadError && (
            <p role="alert" className="mt-1 text-xs text-destructive">
              {t(sourceUploadError)}
            </p>
          )}
          {isUploadingSource && (
            <div
              className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white p-3 text-xs text-neutral-600"
              role="status"
              aria-live="polite"
            >
              <span
                aria-hidden="true"
                className="size-3.5 animate-pulse rounded-full bg-neutral-300"
              />
              <span className="min-w-0 flex-1 truncate">
                {t("courseAuthoring.sources.uploading", {
                  name: uploadingSourceName ?? t("courseAuthoring.sources.upload"),
                })}
              </span>
            </div>
          )}
          {visibleSources.length === 0 ? (
            <p className="mt-2 rounded-lg border border-dashed border-neutral-300 bg-white p-3 text-xs text-neutral-600">
              {t("courseAuthoring.sources.emptyLibrary")}
            </p>
          ) : (
            <div className="scrollbar-hide mt-2 max-h-64 space-y-2 overflow-y-auto">
              {visibleSources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2"
                >
                  <div className="min-w-0 flex-1 px-1">
                    <span className="block truncate text-sm font-medium">{source.name}</span>
                    <span className="text-xs text-neutral-500">
                      {t(`courseAuthoring.sources.status.${source.status}`)} ·{" "}
                      {source.readableSections ?? 0}/{source.totalSections ?? 0}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-xs text-neutral-600"
                    disabled={disabled}
                    onClick={() => {
                      setDisconnectedSourceIds((current) => {
                        const next = new Set(current);
                        next.add(source.id);
                        return next;
                      });
                      updatePolicy({
                        ...policy,
                        sourceVersionIds: policy.sourceVersionIds.filter((id) => id !== source.id),
                      });
                    }}
                  >
                    {t("courseAuthoring.sources.remove")}
                  </Button>
                </div>
              ))}
            </div>
          )}
          {onRefreshSource && sourceRefreshes.length > 0 && (
            <div className="mt-3">
              <SourceRefreshPanel
                sourceRefreshes={sourceRefreshes}
                sources={sources}
                sourcePolicy={policy}
                disabled={disabled}
                onRefreshSource={onRefreshSource}
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
