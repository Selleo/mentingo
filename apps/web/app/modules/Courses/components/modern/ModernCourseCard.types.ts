export type CourseCardMediaState = "idle" | "preload" | "play";

export type ExpandedCardBounds = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type ExpandedCardOffsetInput = {
  cardRect: ExpandedCardBounds;
  panelHeight: number;
  bounds: ExpandedCardBounds;
  scale: number;
  margin: number;
  minLift: number;
};

export type ExpandedCardOffset = {
  x: number;
  y: number;
};

export type ExpandedCardEdgeCoverageInput = {
  cardRect: ExpandedCardBounds;
  rowRect: ExpandedCardBounds;
  offsetX: number;
  scale: number;
  edgeWidth: number;
};

export type ExpandedCardLayout = {
  offset: ExpandedCardOffset;
  coversRowEdge: boolean;
};
