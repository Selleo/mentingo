import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";

import type { ReactElement, ReactNode } from "react";

const MASONRY_COLUMNS = {
  LEFT: "left",
  RIGHT: "right",
} as const;

type MasonryColumn = (typeof MASONRY_COLUMNS)[keyof typeof MASONRY_COLUMNS];

const TRAILING_ITEM_KEY = "masonry-trailing-item";

type MasonryBatchItem = {
  key: string;
  element: ReactNode;
  shouldFillColumn?: boolean;
};

type MasonryLayout = {
  batchKey: string;
  columns: MasonryColumn[];
};

export type LearningPathsMasonryBatch = {
  key: string;
  items: ReactElement[];
};

type LearningPathsMasonryProps = {
  batches: LearningPathsMasonryBatch[];
  batchSize: number;
  trailingItem?: ReactNode;
};

const getAlternatingColumn = (index: number) =>
  index % 2 === 0 ? MASONRY_COLUMNS.LEFT : MASONRY_COLUMNS.RIGHT;

const assignItemsToShorterColumns = (itemHeights: number[]) => {
  const columnHeights = { [MASONRY_COLUMNS.LEFT]: 0, [MASONRY_COLUMNS.RIGHT]: 0 };

  return itemHeights.map((itemHeight) => {
    const column =
      columnHeights[MASONRY_COLUMNS.LEFT] <= columnHeights[MASONRY_COLUMNS.RIGHT]
        ? MASONRY_COLUMNS.LEFT
        : MASONRY_COLUMNS.RIGHT;

    columnHeights[column] += itemHeight;
    return column;
  });
};

function LearningPathsMasonryBatchColumns({
  items,
  shouldAlignColumnEnds,
}: {
  items: MasonryBatchItem[];
  shouldAlignColumnEnds: boolean;
}) {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const batchKey = items.map((item) => item.key).join("|");
  const [layout, setLayout] = useState<MasonryLayout | null>(null);

  const isMeasured = layout?.batchKey === batchKey;

  useLayoutEffect(() => {
    if (isMeasured) return;

    const measureFrame = requestAnimationFrame(() => {
      const itemHeights = itemRefs.current
        .slice(0, items.length)
        .map((itemElement) => itemElement?.offsetHeight ?? 0);
      setLayout({ batchKey, columns: assignItemsToShorterColumns(itemHeights) });
    });

    return () => cancelAnimationFrame(measureFrame);
  }, [batchKey, isMeasured, items.length]);

  const getItemColumn = (index: number) =>
    isMeasured ? layout.columns[index] : getAlternatingColumn(index);

  const renderColumn = (column: MasonryColumn) => {
    const columnItemIndexes = items
      .map((_, index) => index)
      .filter((index) => getItemColumn(index) === column);
    const lastColumnItemIndex = columnItemIndexes.at(-1);

    return (
      <div className="flex flex-col gap-6 max-lg:contents">
        {columnItemIndexes.map((index) => (
          <div
            key={items[index].key}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            style={{ order: index }}
            className={cn("flex flex-col [&>*]:flex-1", {
              "lg:flex-1":
                isMeasured &&
                (shouldAlignColumnEnds ||
                  (index === lastColumnItemIndex && items[index].shouldFillColumn)),
            })}
          >
            {items[index].element}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className={cn("flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-stretch", {
        "lg:invisible": !isMeasured,
      })}
    >
      {renderColumn(MASONRY_COLUMNS.LEFT)}
      {renderColumn(MASONRY_COLUMNS.RIGHT)}
    </div>
  );
}

export function LearningPathsMasonry({
  batches,
  batchSize,
  trailingItem,
}: LearningPathsMasonryProps) {
  const lastBatchIndex = batches.length - 1;
  const isLastBatchFull = (batches.at(-1)?.items.length ?? 0) >= batchSize;
  const shouldPlaceTrailingItemInColumn = Boolean(trailingItem) && !isLastBatchFull;
  const shouldPlaceTrailingItemBelow = Boolean(trailingItem) && isLastBatchFull;

  return (
    <div className="flex flex-col gap-6">
      {batches.map((batch, batchIndex) => {
        const items: MasonryBatchItem[] = batch.items.map((item, index) => ({
          key: String(item.key ?? index),
          element: item,
        }));

        const isLastBatch = batchIndex === lastBatchIndex;

        if (shouldPlaceTrailingItemInColumn && isLastBatch) {
          items.push({ key: TRAILING_ITEM_KEY, element: trailingItem, shouldFillColumn: true });
        }

        return (
          <LearningPathsMasonryBatchColumns
            key={batch.key}
            items={items}
            shouldAlignColumnEnds={!isLastBatch || shouldPlaceTrailingItemBelow}
          />
        );
      })}

      {shouldPlaceTrailingItemInColumn && !batches.length && (
        <LearningPathsMasonryBatchColumns
          items={[{ key: TRAILING_ITEM_KEY, element: trailingItem, shouldFillColumn: true }]}
          shouldAlignColumnEnds={false}
        />
      )}

      {shouldPlaceTrailingItemBelow && (
        <div className="flex min-h-[200px] flex-col [&>*]:flex-1">{trailingItem}</div>
      )}
    </div>
  );
}
