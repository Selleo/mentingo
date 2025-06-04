import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Fragment, useMemo, useState } from "react";

import { DragTrigger } from "./components/DragTrigger";
import { SortableItem } from "./components/SortableItem";
import { SortableOverlay } from "./components/SortableOverlay";

import type { Active, UniqueIdentifier } from "@dnd-kit/core";
import type { ReactNode } from "react";

type BaseItem = {
  sortableId: UniqueIdentifier;
};

type SortableListProps<T extends BaseItem> = {
  items: T[];
  onChange(items: T[], newChapterPosition: number, newDisplayOrder: number): void;
  renderItem(item: T, index: number): ReactNode;
  className?: string;
};

export type Sortable<T> = T & { sortableId: string };

/**
 * A sortable list component that allows users to rearrange items by dragging and dropping.
 * This component is unstyled, allowing full customization through external CSS classes.
 *
 * @param {Object[]} items - Array of items to be rendered in the list.
 * @param {Function} onChange - Callback function invoked when the order of items changes.
 * @param {Function} renderItem - Function to render each item in the list. It receives an item as a parameter and should return a React node.
 * @param {string} [className] - Additional CSS classes for styling the container.
 *
 */
export function SortableList<T extends BaseItem>({
  items,
  onChange,
  renderItem,
  className,
}: SortableListProps<T>) {
  const [active, setActive] = useState<Active | null>(null);
  const activeItem = useMemo(
    () => items.find((item) => item.sortableId === active?.id),
    [active, items],
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={({ active }) => {
        setActive(active);
      }}
      onDragEnd={({ active, over }) => {
        const activeIndex = items.findIndex(({ sortableId }) => sortableId === active?.id);
        const overIndex = items.findIndex(({ sortableId }) => sortableId === over?.id);

        const updatedItems = arrayMove(items, activeIndex, overIndex);

        const updatedItemsWithOrder = updatedItems.map((item, index) => ({
          ...item,
          displayOrder: index + 1,
        }));

        const updatedItem = updatedItemsWithOrder.find((item) => item.sortableId === active?.id);

        const newChapterPosition = updatedItemsWithOrder.indexOf(updatedItem!);

        const newDisplayOrder = newChapterPosition + 1;

        onChange(updatedItemsWithOrder, newChapterPosition, newDisplayOrder);
        setActive(null);
      }}
      onDragCancel={() => {
        setActive(null);
      }}
    >
      <SortableContext items={items.map((item) => item.sortableId)}>
        <ul {...(className && { className })} role="application">
          {items.map((item, index) => (
            <Fragment key={item.sortableId}>{renderItem(item, index)}</Fragment>
          ))}
        </ul>
      </SortableContext>
      <div className="list-none">
        <SortableOverlay>
          {activeItem ? renderItem(activeItem, items.indexOf(activeItem)) : null}
        </SortableOverlay>
      </div>
    </DndContext>
  );
}

SortableList.Item = SortableItem;
SortableList.DragHandle = DragTrigger;
