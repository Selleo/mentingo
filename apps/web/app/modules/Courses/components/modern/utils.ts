import type {
  ExpandedCardEdgeCoverageInput,
  ExpandedCardOffset,
  ExpandedCardOffsetInput,
} from "./ModernCourseCard.types";

export const formatDuration = (minutes?: number) => {
  if (!minutes || minutes <= 0) return undefined;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0 && remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}min`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${remainingMinutes}min`;
};

export const getProgressPercent = (completed?: number, total?: number) => {
  if (!completed || !total || total <= 0) return undefined;

  return Math.min(100, Math.round((completed / total) * 100));
};

export const getExpandedCardOffset = ({
  cardRect,
  panelHeight,
  bounds,
  scale,
  margin,
  minLift,
}: ExpandedCardOffsetInput): ExpandedCardOffset => {
  const cardWidth = cardRect.right - cardRect.left;
  const cardHeight = cardRect.bottom - cardRect.top;
  const horizontalGrowth = (cardWidth * (scale - 1)) / 2;
  const expandedLeft = cardRect.left - horizontalGrowth;
  const expandedRight = cardRect.right + horizontalGrowth;
  const expandedHeight = (cardHeight + panelHeight) * scale;

  const minLeft = bounds.left + margin;
  const maxRight = bounds.right - margin;
  const minTop = bounds.top + margin;
  const maxBottom = bounds.bottom - margin;

  const overflowLeft = Math.ceil(Math.max(0, minLeft - expandedLeft));
  const overflowRight = Math.ceil(Math.max(0, expandedRight - maxRight));
  const x = overflowLeft > 0 ? overflowLeft : 0 - overflowRight;

  const liftToFitBottom = Math.floor(maxBottom - (cardRect.top + expandedHeight));
  const y = Math.max(Math.min(-minLift, liftToFitBottom), Math.ceil(minTop - cardRect.top));

  return { x, y };
};

export const doesExpandedCardCoverRowEdge = ({
  cardRect,
  rowRect,
  offsetX,
  scale,
  edgeWidth,
}: ExpandedCardEdgeCoverageInput) => {
  const horizontalGrowth = ((cardRect.right - cardRect.left) * (scale - 1)) / 2;
  const expandedLeft = cardRect.left - horizontalGrowth + offsetX;
  const expandedRight = cardRect.right + horizontalGrowth + offsetX;

  return expandedLeft < rowRect.left + edgeWidth || expandedRight > rowRect.right - edgeWidth;
};
