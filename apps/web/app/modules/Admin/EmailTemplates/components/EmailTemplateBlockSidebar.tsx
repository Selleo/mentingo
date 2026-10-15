import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import { EMAIL_TEMPLATE_BLOCK_OPTIONS } from "../emailTemplates.constants";

import { EmailTemplateBlockPalette } from "./EmailTemplateBlockPalette";
import { EmailTemplatePlaceholders } from "./EmailTemplatePlaceholders";

import type { EmailTemplateBlock, EmailTemplateVariables } from "../emailTemplates.types";
import type { AutomationPlaceholderDefinition } from "@repo/shared";

export type EmailTemplateBlockSidebarProps = {
  variables: EmailTemplateVariables;
  placeholders?: AutomationPlaceholderDefinition[];
  onPlaceholdersChange?: (value: AutomationPlaceholderDefinition[]) => void;
  disabled: boolean;
  hidden: boolean;
  onInsertBlock: (type: EmailTemplateBlock["type"]) => void;
  onInsertVariable: (token: string) => void;
};

export function EmailTemplateBlockSidebar({
  variables,
  placeholders,
  onPlaceholdersChange,
  disabled,
  hidden,
  onInsertBlock,
  onInsertVariable,
}: EmailTemplateBlockSidebarProps) {
  const { t } = useTranslation();
  return (
    <aside
      className={cn("min-w-0 space-y-6 border-b bg-white p-4 lg:border-b-0 lg:border-r", {
        hidden: hidden,
      })}
      data-testid={EMAIL_TEMPLATES_HANDLES.PALETTE}
    >
      <div className="space-y-2">
        <h5 className="text-sm font-semibold">{t("emailTemplates.ui.blockPalette")}</h5>
        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
          {EMAIL_TEMPLATE_BLOCK_OPTIONS.map((type) => (
            <EmailTemplateBlockPalette
              key={type}
              type={type}
              disabled={disabled}
              onInsert={() => onInsertBlock(type)}
            />
          ))}
        </div>
      </div>
      <EmailTemplatePlaceholders
        value={placeholders}
        variables={variables}
        onChange={onPlaceholdersChange}
        onInsertVariable={onInsertVariable}
        disabled={disabled}
      />
    </aside>
  );
}
