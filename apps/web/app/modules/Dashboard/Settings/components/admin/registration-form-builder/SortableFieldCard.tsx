import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

type SortableFieldCardProps = {
  children: (props: {
    attributes: ReturnType<typeof useSortable>["attributes"];
    listeners: ReturnType<typeof useSortable>["listeners"];
  }) => ReactNode;
  id: string;
};

export function SortableFieldCard({ children, id }: SortableFieldCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "z-10 opacity-70")}
    >
      {children({ attributes, listeners })}
    </div>
  );
}
