import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";

import { withAuthoringAssetPreviewUrls } from "./authoringAssetPreview";
import { AuthoringContentPreview } from "./AuthoringContentPreview";
import { diffContentBlocks, diffWords } from "./contentDiff";
import { BLOCK_DIFF_STATUS, CONTENT_VIEW_MODE, WORD_DIFF_TYPE } from "./curriculumReview.constants";

import type { BlockDiffEntry, ContentBlock } from "./contentDiff";

type Props = {
  before: string;
  after: string;
  assetPreviewUrls?: Readonly<Record<string, string>>;
  trustedContent?: string;
};

type ViewMode = (typeof CONTENT_VIEW_MODE)[keyof typeof CONTENT_VIEW_MODE];

const SEGMENT_KIND = { ENTRY: "entry", UNCHANGED: "unchanged" } as const;

const HEADING_TAG = /^<h([1-6])\b/i;

const blockTextClass = (block: ContentBlock) => {
  const heading = HEADING_TAG.exec(block.html);
  if (!heading) return "text-sm leading-6";
  return Number(heading[1]) <= 2 ? "text-lg font-semibold" : "text-base font-semibold";
};

const WordDiff = ({ before, after }: { before: ContentBlock; after: ContentBlock }) => (
  <p className={cn("whitespace-pre-wrap text-neutral-900", blockTextClass(after))}>
    {diffWords(before.text, after.text).map((part, index) =>
      part.type === WORD_DIFF_TYPE.SAME ? (
        <span key={index}>{part.text}</span>
      ) : (
        <span
          key={index}
          className={cn("rounded-sm px-0.5", {
            "bg-success-100 text-success-900": part.type === WORD_DIFF_TYPE.ADDED,
            "bg-error-50 text-error-700 line-through": part.type === WORD_DIFF_TYPE.REMOVED,
          })}
        >
          {part.text}
        </span>
      ),
    )}
  </p>
);

/** Blocks without text (images, embeds) are compared rendered side by side. */
const hasComparableText = (entry: { before: ContentBlock; after: ContentBlock }) =>
  entry.before.text.length > 0 && entry.after.text.length > 0;

type Segment =
  | { kind: typeof SEGMENT_KIND.ENTRY; entry: BlockDiffEntry }
  | { kind: typeof SEGMENT_KIND.UNCHANGED; entries: BlockDiffEntry[] };

const segment = (entries: BlockDiffEntry[]): Segment[] =>
  entries.reduce<Segment[]>((segments, entry) => {
    const last = segments.at(-1);
    if (entry.status === BLOCK_DIFF_STATUS.UNCHANGED) {
      if (last?.kind === SEGMENT_KIND.UNCHANGED) last.entries.push(entry);
      else segments.push({ kind: SEGMENT_KIND.UNCHANGED, entries: [entry] });
    } else segments.push({ kind: SEGMENT_KIND.ENTRY, entry });
    return segments;
  }, []);

const UnchangedRun = ({
  entries,
  assetPreviewUrls,
  trustedContent,
}: {
  entries: BlockDiffEntry[];
  trustedContent: string;
  assetPreviewUrls?: Readonly<Record<string, string>>;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <div className="space-y-2 opacity-80">
        {entries.map(
          (entry, index) =>
            entry.status === BLOCK_DIFF_STATUS.UNCHANGED && (
              <AuthoringContentPreview
                assetPreviewUrls={assetPreviewUrls}
                trustedContent={trustedContent}
                key={index}
                content={entry.after.html}
                className="text-sm"
              />
            ),
        )}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 text-xs font-medium text-neutral-500 hover:text-neutral-800"
      onClick={() => setOpen(true)}
    >
      <span className="h-px flex-1 bg-neutral-200" />
      {t("courseAuthoring.reviewMode.unchangedBlocks", { count: entries.length })}
      <span className="h-px flex-1 bg-neutral-200" />
    </button>
  );
};

export const ContentDiffView = ({
  before,
  after,
  assetPreviewUrls = {},
  trustedContent = before,
}: Props) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<ViewMode>(CONTENT_VIEW_MODE.CHANGES);
  const previewBefore = withAuthoringAssetPreviewUrls(before, assetPreviewUrls);
  const previewAfter = withAuthoringAssetPreviewUrls(after, assetPreviewUrls);
  const entries = useMemo(
    () => diffContentBlocks(previewBefore, previewAfter),
    [previewBefore, previewAfter],
  );
  const segments = useMemo(() => segment(entries), [entries]);
  const changedCount = entries.filter(
    (entry) => entry.status !== BLOCK_DIFF_STATUS.UNCHANGED,
  ).length;

  return (
    <div className="space-y-3" data-testid="course-authoring-review-content-diff">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-600">
          {t("courseAuthoring.reviewMode.changedBlocks", { count: changedCount })}
        </p>
        <Tabs value={mode} onValueChange={(value) => setMode(value as ViewMode)}>
          <TabsList aria-label={t("courseAuthoring.reviewMode.viewMode")}>
            {Object.values(CONTENT_VIEW_MODE).map((value) => (
              <TabsTrigger key={value} value={value}>
                {t(`courseAuthoring.reviewMode.view.${value}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {mode === CONTENT_VIEW_MODE.BEFORE && (
        <AuthoringContentPreview
          assetPreviewUrls={assetPreviewUrls}
          trustedContent={trustedContent}
          content={previewBefore}
          className="text-sm"
        />
      )}
      {mode === CONTENT_VIEW_MODE.AFTER && (
        <AuthoringContentPreview
          assetPreviewUrls={assetPreviewUrls}
          trustedContent={trustedContent}
          content={previewAfter}
          className="text-sm"
        />
      )}
      {mode === CONTENT_VIEW_MODE.CHANGES && (
        <div className="space-y-3">
          {segments.map((item, index) => {
            if (item.kind === SEGMENT_KIND.UNCHANGED)
              return (
                <UnchangedRun
                  key={index}
                  entries={item.entries}
                  assetPreviewUrls={assetPreviewUrls}
                  trustedContent={trustedContent}
                />
              );
            const { entry } = item;
            return (
              <div
                key={index}
                className={cn(
                  "relative rounded-lg px-3 py-2 before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-l-lg before:content-['']",
                  {
                    "bg-success-50/50 before:bg-success-500":
                      entry.status === BLOCK_DIFF_STATUS.ADDED,
                    "bg-error-50/50 before:bg-error-400":
                      entry.status === BLOCK_DIFF_STATUS.REMOVED,
                    "bg-warning-50/40 before:bg-warning-500":
                      entry.status === BLOCK_DIFF_STATUS.MODIFIED,
                  },
                )}
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                  {t(`courseAuthoring.reviewMode.blockStatus.${entry.status}`)}
                </p>
                {entry.status === BLOCK_DIFF_STATUS.ADDED && (
                  <AuthoringContentPreview
                    assetPreviewUrls={assetPreviewUrls}
                    trustedContent={trustedContent}
                    content={entry.after.html}
                    className="text-sm"
                  />
                )}
                {entry.status === BLOCK_DIFF_STATUS.REMOVED && (
                  <AuthoringContentPreview
                    assetPreviewUrls={assetPreviewUrls}
                    trustedContent={trustedContent}
                    content={entry.before.html}
                    className="text-sm text-neutral-500 line-through decoration-error-400"
                  />
                )}
                {entry.status === BLOCK_DIFF_STATUS.MODIFIED &&
                  (hasComparableText(entry) ? (
                    <WordDiff before={entry.before} after={entry.after} />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <AuthoringContentPreview
                        assetPreviewUrls={assetPreviewUrls}
                        trustedContent={trustedContent}
                        content={entry.before.html}
                        className="text-sm opacity-70"
                      />
                      <AuthoringContentPreview
                        assetPreviewUrls={assetPreviewUrls}
                        trustedContent={trustedContent}
                        content={entry.after.html}
                        className="text-sm"
                      />
                    </div>
                  ))}
              </div>
            );
          })}
          {entries.length === 0 && (
            <p className="text-sm text-neutral-500">{t("courseAuthoring.reviewMode.noContent")}</p>
          )}
        </div>
      )}
    </div>
  );
};
