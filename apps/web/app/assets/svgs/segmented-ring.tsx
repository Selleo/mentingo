import type React from "react";

type SegmentedRingProps = React.SVGProps<SVGSVGElement> & {
  segments?: number;
  completed?: number;
  size?: number;
  strokeWidth?: number | string;
};

export const SegmentedRing: React.FC<SegmentedRingProps> = ({
  segments = 1,
  completed = 0,
  size = 16,
  strokeWidth = 2,
  className,
  ...svgProps
}) => {
  const numericStrokeWidth =
    typeof strokeWidth === "string" ? Number.parseFloat(strokeWidth) || 2 : strokeWidth;

  const safeSegments = Math.max(0, Math.floor(segments));
  if (safeSegments <= 0) return null;
  const safeCompleted = Math.min(Math.max(0, Math.floor(completed)), safeSegments);

  const radius = (size - numericStrokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Use fixed pixel gap for separators to keep visual separators thin and consistent
  // Matches design better and fixes segments=1 (no huge missing arc)
  const baseGapPx = Math.max(1, Math.round(numericStrokeWidth));
  // Ensure gaps never exceed reasonable fraction of each slice
  const maxGapPerSlice = (circumference / safeSegments) * 0.2;
  const computedGapLength = Math.min(baseGapPx, maxGapPerSlice);
  const gapLength = safeSegments === 1 ? 0 : computedGapLength;
  const segmentLength = Math.max(0, (circumference - safeSegments * gapLength) / safeSegments);

  const trackDashArray = Array.from({ length: safeSegments })
    .flatMap(() => [segmentLength, gapLength])
    .join(" ");

  const overlayArray: number[] = [];
  for (let i = 0; i < safeSegments; i++) {
    if (i < safeCompleted) {
      overlayArray.push(segmentLength, gapLength);
    } else {
      overlayArray.push(0, segmentLength + gapLength);
    }
  }

  const overlayDashArray = overlayArray.join(" ");

  const center = size / 2;
  const transform = `rotate(-90 ${center} ${center})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label={`${safeCompleted}/${safeSegments}`}
      {...svgProps}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--neutral-200)"
        strokeWidth={numericStrokeWidth}
        strokeDasharray={trackDashArray}
        transform={transform}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="var(--success-500)"
        strokeWidth={numericStrokeWidth}
        strokeDasharray={overlayDashArray}
        transform={transform}
      />
    </svg>
  );
};

export default SegmentedRing;
