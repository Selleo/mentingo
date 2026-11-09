import { cn } from "~/lib/utils";

type SliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
  className?: string;
  "aria-label"?: string;
  "aria-valuetext"?: string;
};

// Same look as the reasoning slider in AuthoringReasoningControl.
export function Slider({
  value,
  min,
  max,
  step = 1,
  disabled,
  onValueChange,
  className,
  ...ariaProps
}: SliderProps) {
  const clampedValue = Math.min(Math.max(value, min), max);
  const progress = max > min ? ((clampedValue - min) / (max - min)) * 100 : 0;

  return (
    <div className={cn("group relative h-6", className)}>
      <div className="absolute inset-x-2.5 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-neutral-200">
        <div className="h-full rounded-full bg-primary-700" style={{ width: `${progress}%` }} />
      </div>
      <div className="pointer-events-none absolute inset-x-2.5 top-1/2 -translate-y-1/2">
        <span
          aria-hidden="true"
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary-700 bg-white shadow-md group-has-[:focus-visible]:ring-2 group-has-[:focus-visible]:ring-primary-500 group-has-[:focus-visible]:ring-offset-2"
          style={{ left: `${progress}%` }}
        />
      </div>
      {/* The native range keeps drag, arrow/Home/End keys and screen reader output intact. */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clampedValue}
        disabled={disabled}
        onChange={(event) => onValueChange(Number(event.target.value))}
        {...ariaProps}
        className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
}
