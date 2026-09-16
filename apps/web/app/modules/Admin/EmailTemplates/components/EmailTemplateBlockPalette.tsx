import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { EMAIL_TEMPLATE_BLOCK_ICONS, EMAIL_TEMPLATE_DRAG_TYPES } from "../emailTemplates.constants";

import type { EmailTemplateBlock } from "../emailTemplates.types";

export type EmailTemplateBlockPaletteProps = {
  type: EmailTemplateBlock["type"];
  disabled: boolean;
  onInsert: () => void;
};

export function EmailTemplateBlockPalette({
  type,
  disabled,
  onInsert,
}: EmailTemplateBlockPaletteProps) {
  const { t } = useTranslation();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    disabled,
    data: { kind: EMAIL_TEMPLATE_DRAG_TYPES.PALETTE, blockType: type },
  });

  const BlockIcon = EMAIL_TEMPLATE_BLOCK_ICONS[type];

  return (
    <Button
      ref={setNodeRef}
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      className={cn("w-full justify-start gap-2 bg-white text-neutral-900", {
        "opacity-40": isDragging,
      })}
      onClick={onInsert}
      {...attributes}
      {...listeners}
    >
      <BlockIcon className="size-4 shrink-0" />
      <span className="flex-1 text-left">{t(`emailTemplates.ui.blocks.${type}`)}</span>
      <GripVertical className="size-3 text-neutral-400" />
    </Button>
  );
}
