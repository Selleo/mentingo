import { useDroppable } from "@dnd-kit/core";
import { Mail, Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { cn } from "~/lib/utils";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import {
  EMAIL_TEMPLATE_BLOCK_ICONS,
  EMAIL_TEMPLATE_BLOCK_OPTIONS,
  EMAIL_TEMPLATE_DRAG_TYPES,
} from "../emailTemplates.constants";

import type { EmailTemplateBlock } from "../emailTemplates.types";

export type EmailTemplateInsertionPointProps = {
  index: number;
  disabled: boolean;
  onInsert: (type: EmailTemplateBlock["type"]) => void;
  visible?: boolean;
  emptyCanvas?: boolean;
};

export function EmailTemplateInsertionPoint({
  index,
  disabled,
  onInsert,
  visible = false,
  emptyCanvas = false,
}: EmailTemplateInsertionPointProps) {
  const { t } = useTranslation();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `insertion-${index}`,
    disabled,
    data: { kind: EMAIL_TEMPLATE_DRAG_TYPES.INSERTION, index },
  });
  if (disabled && !emptyCanvas) return null;
  return (
    <div
      ref={setNodeRef}
      data-testid={EMAIL_TEMPLATES_HANDLES.INSERTION}
      className={cn({
        "absolute inset-x-0 top-0 z-10 flex h-6 -translate-y-1/2 items-center justify-center opacity-0 pointer-events-none focus-within:opacity-100 focus-within:pointer-events-auto":
          !emptyCanvas,
        "opacity-100 pointer-events-auto": !emptyCanvas && (visible || isOver || isPaletteOpen),
        "flex min-h-[360px] flex-1 flex-col items-center justify-center gap-5 px-6 py-12 text-center":
          emptyCanvas,
        "bg-primary-50": emptyCanvas && isOver,
      })}
    >
      {emptyCanvas ? (
        <>
          <div className="flex size-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
            <Mail className="size-6" aria-hidden="true" />
          </div>
          <div className="max-w-xs space-y-2">
            <h3 className="text-base font-medium text-neutral-900">
              {t("emailTemplates.ui.emptyCanvasTitle")}
            </h3>
            <p className="text-sm text-neutral-500">
              {t("emailTemplates.ui.emptyCanvasDescription")}
            </p>
          </div>
        </>
      ) : (
        <div className="absolute inset-x-0 border-t border-primary-400" />
      )}
      {!disabled && (
        <Popover open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size={emptyCanvas ? "default" : "icon"}
              variant={emptyCanvas ? "default" : "outline"}
              className={cn({
                "relative size-6 rounded-full border-primary-200 bg-white text-primary-700 hover:bg-primary-50":
                  !emptyCanvas,
                "gap-2": emptyCanvas,
              })}
              aria-label={
                emptyCanvas
                  ? t("emailTemplates.ui.addFirstBlock")
                  : `${t("emailTemplates.ui.addBlock")} ${index + 1}`
              }
            >
              <Plus className="size-3.5" />
              {emptyCanvas && t("emailTemplates.ui.addFirstBlock")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="grid w-64 grid-cols-2 gap-1 p-2">
            {EMAIL_TEMPLATE_BLOCK_OPTIONS.map((type) => {
              const BlockIcon = EMAIL_TEMPLATE_BLOCK_ICONS[type];
              return (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  key={type}
                  data-testid={EMAIL_TEMPLATES_HANDLES.INSERT_BLOCK(type)}
                  className="justify-start gap-2"
                  onClick={() => {
                    onInsert(type);
                    setIsPaletteOpen(false);
                  }}
                >
                  <BlockIcon className="size-4" />
                  {t(`emailTemplates.ui.blocks.${type}`)}
                </Button>
              );
            })}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
