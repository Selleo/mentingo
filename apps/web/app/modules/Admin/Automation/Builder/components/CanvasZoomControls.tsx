import { Minus, Plus, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import type { FC } from "react";

interface CanvasZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

export const CanvasZoomControls: FC<CanvasZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}) => {
  const { t } = useTranslation();

  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background px-2 py-1 shadow-md">
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onZoomOut}
        disabled={zoom <= 0.25}
        aria-label={t("automationBuilder.canvas.zoomOut")}
      >
        <Minus className="size-4" />
      </Button>

      <button
        type="button"
        onClick={onZoomReset}
        className="min-w-[3rem] rounded px-1.5 py-0.5 text-center text-xs font-medium text-muted-foreground hover:bg-muted"
        aria-label={t("automationBuilder.canvas.zoomReset")}
      >
        {Math.round(zoom * 100)}%
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onZoomIn}
        disabled={zoom >= 2}
        aria-label={t("automationBuilder.canvas.zoomIn")}
      >
        <Plus className="size-4" />
      </Button>

      <div className="mx-1 h-4 w-px bg-border" />

      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={onZoomReset}
        aria-label={t("automationBuilder.canvas.zoomReset")}
      >
        <RotateCcw className="size-3.5" />
      </Button>
    </div>
  );
};
