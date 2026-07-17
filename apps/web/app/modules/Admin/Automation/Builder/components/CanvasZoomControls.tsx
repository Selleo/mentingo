import { Minus, Plus, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

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
    <TooltipProvider>
      <div className="flex items-center justify-center border-t bg-background py-2">
        <div className="flex items-center gap-1 rounded-lg border px-2 py-1 shadow-sm">
          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent side="top">{t("automationBuilder.canvas.zoomOut")}</TooltipContent>
          </Tooltip>

          <Button
            variant="ghost"
            size="xs"
            className="min-w-[3rem] text-xs font-medium text-muted-foreground"
            onClick={onZoomReset}
            aria-label={t("automationBuilder.canvas.zoomReset")}
          >
            {Math.round(zoom * 100)}%
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
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
            </TooltipTrigger>
            <TooltipContent side="top">{t("automationBuilder.canvas.zoomIn")}</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-4" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={onZoomReset}
                aria-label={t("automationBuilder.canvas.zoomReset")}
              >
                <RotateCcw className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{t("automationBuilder.canvas.zoomReset")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
};
