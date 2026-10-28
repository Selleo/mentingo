import { defaultDropAnimationSideEffects, DragOverlay } from "@dnd-kit/core";
import { createPortal } from "react-dom";

import type { DropAnimation } from "@dnd-kit/core";
import type { PropsWithChildren } from "react";

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.4",
      },
    },
  }),
};

type SortableOverlayProps = PropsWithChildren<{
  /** Renders the drag preview in document.body, needed inside transformed containers such as dialogs. */
  portalled?: boolean;
}>;

export const SortableOverlay = ({ children, portalled = false }: SortableOverlayProps) => {
  const overlay = <DragOverlay dropAnimation={dropAnimationConfig}>{children}</DragOverlay>;
  if (!portalled || typeof document === "undefined") return overlay;
  return createPortal(<div className="list-none">{overlay}</div>, document.body);
};
