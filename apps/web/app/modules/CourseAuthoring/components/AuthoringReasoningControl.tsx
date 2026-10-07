/** Selects first-party Luna reasoning effort independently of source research depth. */
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

import type { AuthoringRequest } from "../courseAuthoring.types";

type ReasoningEffort = AuthoringRequest["reasoningEffort"];

const efforts: ReasoningEffort[] = ["low", "medium", "high"];

type Props = {
  value: ReasoningEffort;
  onChange: (value: ReasoningEffort) => void;
  disabled?: boolean;
};

/** Rising bars that light up to the selected effort, shared by the chip and the popover. */
const EffortMeter = ({ level, className }: { level: number; className?: string }) => (
  <span aria-hidden="true" className={cn("inline-flex items-end gap-[2px]", className)}>
    {efforts.map((effort, index) => (
      <span
        key={effort}
        className={cn(
          "w-[3px] rounded-full transition-colors",
          index <= level ? "bg-current" : "bg-current opacity-25",
        )}
        style={{ height: `${6 + index * 3}px` }}
      />
    ))}
  </span>
);

/** Shows the current effort as a compact composer chip and a discrete three-stop slider. */
export const AuthoringReasoningControl = ({ value, onChange, disabled }: Props) => {
  const { t } = useTranslation();
  const index = Math.max(efforts.indexOf(value), 0);
  const label = t(`courseAuthoring.reasoning.${value}`);
  const progress = (index / (efforts.length - 1)) * 100;

  return (
    <Popover modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="group flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:pointer-events-none disabled:opacity-50 data-[state=open]:bg-primary-50 data-[state=open]:text-primary-700"
          aria-label={t("courseAuthoring.reasoning.control", { level: label })}
          title={t("courseAuthoring.reasoning.control", { level: label })}
          data-vaul-no-drag
          onPointerDown={(event) => event.stopPropagation()}
        >
          <EffortMeter level={index} />
          <span>{label}</span>
          <ChevronDown
            className="size-3 shrink-0 opacity-60 transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        portalled={false}
        align="end"
        side="top"
        sideOffset={8}
        data-vaul-no-drag
        className="z-[70] w-72 rounded-2xl border-neutral-200 p-4 shadow-lg"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-neutral-950">
            {t("courseAuthoring.reasoning.title")}
          </p>
          <span className="flex items-center gap-1.5 text-sm font-medium text-primary-700">
            <EffortMeter level={index} />
            {label}
          </span>
        </div>

        <div className="relative mt-5 h-6">
          <div className="absolute inset-x-2.5 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-neutral-200">
            <div
              className="h-full rounded-full bg-primary-700 transition-[width] duration-200 ease-out motion-reduce:transition-none"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="pointer-events-none absolute inset-x-2.5 top-1/2 -translate-y-1/2">
            {efforts.map((effort, stop) => (
              <span
                key={effort}
                aria-hidden="true"
                className={cn(
                  "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
                  stop <= index ? "bg-white/80" : "bg-neutral-400",
                )}
                style={{ left: `${(stop / (efforts.length - 1)) * 100}%` }}
              />
            ))}
            <span
              aria-hidden="true"
              className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary-700 bg-white shadow-md transition-[left] duration-200 ease-out motion-reduce:transition-none"
              style={{ left: `${progress}%` }}
            />
          </div>
          {/* The native range keeps drag, arrow/Home/End keys and screen reader output intact. */}
          <input
            type="range"
            min={0}
            max={efforts.length - 1}
            step={1}
            value={index}
            disabled={disabled}
            onChange={(event) => onChange(efforts[Number(event.target.value)] ?? "medium")}
            aria-label={t("courseAuthoring.reasoning.title")}
            aria-valuetext={t("courseAuthoring.reasoning.position", {
              level: label,
              position: index + 1,
              total: efforts.length,
            })}
            className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0 disabled:cursor-not-allowed"
          />
        </div>

        <div className="mt-2 grid grid-cols-3 text-xs">
          {efforts.map((effort, stop) => (
            <button
              key={effort}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onClick={() => onChange(effort)}
              className={cn(
                "rounded-md py-1 font-medium text-neutral-500 transition-colors hover:text-neutral-900",
                {
                  "text-left": stop === 0,
                  "text-center": stop === 1,
                  "text-right": stop === efforts.length - 1,
                  "text-primary-700 hover:text-primary-700": effort === value,
                },
              )}
            >
              {t(`courseAuthoring.reasoning.${effort}`)}
            </button>
          ))}
        </div>

        <p className="mt-3 min-h-10 text-sm leading-5 text-neutral-700" aria-live="polite">
          {t(`courseAuthoring.reasoning.${value}Description`)}
        </p>
      </PopoverContent>
    </Popover>
  );
};
