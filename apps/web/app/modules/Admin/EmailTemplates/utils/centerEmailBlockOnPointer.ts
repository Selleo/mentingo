import { getEventCoordinates } from "@dnd-kit/utilities";

import type { Modifier } from "@dnd-kit/core";

export const centerEmailBlockOnPointer: Modifier = ({
  activatorEvent,
  draggingNodeRect,
  transform,
}) => {
  if (!activatorEvent || !draggingNodeRect) return transform;

  const pointer = getEventCoordinates(activatorEvent);

  // Keyboard dragging keeps the sortable sensor's positioning.
  if (!pointer) return transform;

  return {
    ...transform,
    x: transform.x + pointer.x - draggingNodeRect.left - draggingNodeRect.width / 2,
    y: transform.y + pointer.y - draggingNodeRect.top - draggingNodeRect.height / 2,
  };
};
