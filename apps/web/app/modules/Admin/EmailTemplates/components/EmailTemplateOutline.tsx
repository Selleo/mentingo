import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { EMAIL_TEMPLATE_BLOCK_ICONS } from "../emailTemplates.constants";

import type { EmailTemplateBlock } from "../emailTemplates.types";

type EmailTemplateOutlineProps = {
  blocks: EmailTemplateBlock[];
  selectedBlockIndex: number;
  disabled: boolean;
  onSelectBlock: (index: number) => void;
  onRemoveBlock: (index: number) => void;
};

export function EmailTemplateOutline({
  blocks,
  selectedBlockIndex,
  disabled,
  onSelectBlock,
  onRemoveBlock,
}: EmailTemplateOutlineProps) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t("emailTemplates.ui.tableOfContents")} className="space-y-2">
      <h5 className="text-sm font-semibold">{t("emailTemplates.ui.tableOfContents")}</h5>
      <ol className="max-h-64 space-y-1 overflow-y-auto">
        {blocks.map((block, index) => {
          const BlockIcon = EMAIL_TEMPLATE_BLOCK_ICONS[block.type];
          const isSelected = selectedBlockIndex === index;
          return (
            <li key={index} className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                aria-current={isSelected ? "true" : undefined}
                className={cn("min-w-0 flex-1 justify-start gap-2", {
                  "bg-neutral-100": isSelected,
                })}
                onClick={() => onSelectBlock(index)}
              >
                <BlockIcon className="size-4 shrink-0" />
                {index + 1}. {t(`emailTemplates.ui.blocks.${block.type}`)}
              </Button>
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 text-neutral-500 hover:text-destructive"
                  aria-label={`${t("emailTemplates.ui.removeBlock")}: ${index + 1}. ${t(`emailTemplates.ui.blocks.${block.type}`)}`}
                  title={t("emailTemplates.ui.removeBlock")}
                  onClick={() => onRemoveBlock(index)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          );
        })}
      </ol>
      {!blocks.length && (
        <p className="text-xs text-neutral-500">{t("emailTemplates.ui.emptyContent")}</p>
      )}
    </nav>
  );
}
