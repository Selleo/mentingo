import { Check, LayoutGrid } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

import type { DashboardWidgetSize } from "../types";

const SIZE_PREVIEW_CLASSES: Record<DashboardWidgetSize, string> = {
  "1x1": "h-4 w-4",
  "2x1": "h-4 w-8",
  "1x2": "h-8 w-4",
  "2x2": "h-8 w-8",
  "3x2": "h-8 w-12",
  "4x1": "h-4 w-12",
  "4x2": "h-6 w-12",
  "4x3": "h-9 w-12",
};

type DashboardWidgetSizePickerProps = {
  allowedSizes: DashboardWidgetSize[];
  selectedSize?: DashboardWidgetSize;
  title: string;
  onSelect: (size: DashboardWidgetSize) => void;
};

export function DashboardWidgetSizePicker({
  allowedSizes,
  selectedSize,
  title,
  onSelect,
}: DashboardWidgetSizePickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const accessibleLabel = t("dashboardHome.edit.changeSize", { title });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute right-3 top-3 z-20 h-9 gap-1.5 bg-white px-2.5 text-neutral-700 shadow-sm hover:border-primary-300 hover:bg-white hover:text-primary-800"
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          aria-label={accessibleLabel}
          title={accessibleLabel}
        >
          <LayoutGrid className="size-4" aria-hidden="true" />
          <span className="details-md tabular-nums">{selectedSize?.replace("x", "×")}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-64 p-3"
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3 px-1">
          <p className="body-sm-md text-neutral-950">{t("dashboardHome.edit.sizeTitle")}</p>
          <p className="details mt-0.5 truncate text-neutral-500">{title}</p>
        </div>

        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={accessibleLabel}>
          {allowedSizes.map((size) => {
            const selected = size === selectedSize;

            return (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${size} — ${t(`dashboardHome.edit.sizes.${size}`)}`}
                className={cn(
                  "relative flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border bg-white px-2 py-3 text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                  selected && "border-primary-500 bg-primary-50 text-primary-800",
                )}
                onClick={() => {
                  if (!selected) onSelect(size);
                  setOpen(false);
                }}
              >
                {selected && (
                  <Check className="absolute right-2 top-2 size-3.5" aria-hidden="true" />
                )}
                <span
                  className={cn(
                    "rounded-[3px] border-2 border-current bg-current/10",
                    SIZE_PREVIEW_CLASSES[size],
                  )}
                  aria-hidden="true"
                />
                <span className="text-center">
                  <span className="body-sm-md block tabular-nums">{size.replace("x", "×")}</span>
                  <span className="details block text-neutral-500">
                    {t(`dashboardHome.edit.sizes.${size}`)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
