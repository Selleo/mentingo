export type MinimumVisibleDurationControls = {
  isVisible: boolean;
  start: () => void;
  afterMinimumDuration: (onReady: () => void) => void;
  stop: () => void;
};
