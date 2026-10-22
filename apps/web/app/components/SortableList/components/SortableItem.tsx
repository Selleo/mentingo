import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";

import { SortableItemContext } from "~/components/SortableList/components/sortableItemContext";

import type { UniqueIdentifier } from "@dnd-kit/core";
import type { CSSProperties, PropsWithChildren } from "react";

interface SortableItemProps {
  id: UniqueIdentifier;
  className?: string;
  style?: CSSProperties;
}

export function SortableItem({
  children,
  id,
  className,
  style: itemStyle,
}: PropsWithChildren<SortableItemProps>) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id });
  const context = useMemo(
    () => ({
      attributes,
      listeners,
      ref: setActivatorNodeRef,
    }),
    [attributes, listeners, setActivatorNodeRef],
  );

  const style: CSSProperties = {
    ...itemStyle,
    opacity: isDragging ? 0.4 : undefined,
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <SortableItemContext.Provider value={context}>
      <li ref={setNodeRef} className={className} style={style}>
        {children}
      </li>
    </SortableItemContext.Provider>
  );
}
