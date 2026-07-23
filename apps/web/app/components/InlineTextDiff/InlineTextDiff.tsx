import { cn } from "~/lib/utils";

import { createInlineDiff, INLINE_DIFF_SEGMENT_TYPE } from "./inlineDiff";

type InlineTextDiffProps = {
  before?: string | null;
  after?: string | null;
  className?: string;
};

export const InlineTextDiff = ({ before, after, className }: InlineTextDiffProps) => {
  const beforeValue = before?.trim() ?? "";
  const afterValue = after?.trim() ?? "";
  const rootClassName = cn("break-words text-sm leading-6 text-neutral-800", className);

  if (!beforeValue && !afterValue) return null;
  if (beforeValue === afterValue) return <p className={rootClassName}>{afterValue}</p>;

  if (!beforeValue) {
    return (
      <p className={rootClassName}>
        <ins className="rounded-sm bg-success-100 text-success-900 no-underline">{afterValue}</ins>
      </p>
    );
  }

  if (!afterValue) {
    return (
      <p className={rootClassName}>
        <del className="rounded-sm bg-error-50 text-error-800">{beforeValue}</del>
      </p>
    );
  }

  const segments = createInlineDiff(beforeValue, afterValue);
  return (
    <p className={rootClassName}>
      {segments.map((segment, index) => {
        const key = `${segment.type}-${index}`;
        switch (segment.type) {
          case INLINE_DIFF_SEGMENT_TYPE.ADDED:
            return (
              <ins key={key} className="rounded-sm bg-success-100 text-success-900 no-underline">
                {segment.value}
              </ins>
            );
          case INLINE_DIFF_SEGMENT_TYPE.REMOVED:
            return (
              <del key={key} className="rounded-sm bg-error-50 text-error-800">
                {segment.value}
              </del>
            );
          case INLINE_DIFF_SEGMENT_TYPE.UNCHANGED:
            return <span key={key}>{segment.value}</span>;
        }
      })}
    </p>
  );
};
