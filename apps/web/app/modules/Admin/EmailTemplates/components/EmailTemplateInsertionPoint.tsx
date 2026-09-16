import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
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
};

export function EmailTemplateInsertionPoint({
  index,
  disabled,
  onInsert,
  visible = false,
}: EmailTemplateInsertionPointProps) {
  const { t } = useTranslation();
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const { setNodeRef, isOver } = useDroppable({
    id: `insertion-${index}`,
    disabled,
    data: { kind: EMAIL_TEMPLATE_DRAG_TYPES.INSERTION, index },
  });
  if (disabled) return null;
  return (
    <div
      ref={setNodeRef}
      data-testid={EMAIL_TEMPLATES_HANDLES.INSERTION}
      className={cn(
        "absolute inset-x-0 top-0 z-10 flex h-6 -translate-y-1/2 items-center justify-center opacity-0 pointer-events-none focus-within:opacity-100 focus-within:pointer-events-auto",
        {
          "opacity-100 pointer-events-auto": visible || isOver || isPaletteOpen,
        },
      )}
    >
      <div className="absolute inset-x-0 border-t border-primary-400" />
      <Popover open={isPaletteOpen} onOpenChange={setIsPaletteOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="relative size-6 rounded-full border-primary-200 bg-white text-primary-700 hover:bg-primary-50"
            aria-label={`${t("emailTemplates.ui.addBlock")} ${index + 1}`}
          >
            <Plus className="size-3.5" />
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
    </div>
  );
}
