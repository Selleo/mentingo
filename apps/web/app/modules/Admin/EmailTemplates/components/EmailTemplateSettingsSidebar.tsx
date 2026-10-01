import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";

import { EmailTemplateBlockSettings } from "./EmailTemplateBlockSettings";
import { EmailTemplateOutline } from "./EmailTemplateOutline";

import type { EmailTemplateBlock, EmailTemplateVariables } from "../emailTemplates.types";

export type EmailTemplateSettingsSidebarProps = {
  blocks: EmailTemplateBlock[];
  selectedBlockIndex: number;
  onSelectBlock: (index: number) => void;
  onRemoveBlock: (index: number) => void;
  block?: EmailTemplateBlock;
  variables: EmailTemplateVariables;
  disabled: boolean;
  hidden: boolean;
  onChange: (block: EmailTemplateBlock) => void;
  onUpload: (file: File) => Promise<void>;
};

export function EmailTemplateSettingsSidebar({
  blocks,
  selectedBlockIndex,
  onSelectBlock,
  onRemoveBlock,
  block,
  variables,
  disabled,
  hidden,
  onChange,
  onUpload,
}: EmailTemplateSettingsSidebarProps) {
  const { t } = useTranslation();
  return (
    <aside
      data-testid={EMAIL_TEMPLATES_HANDLES.SETTINGS}
      className={cn(
        "min-w-0 space-y-6 border-t bg-white p-4 lg:col-span-2 xl:col-span-1 xl:border-l xl:border-t-0",
        { hidden: hidden },
      )}
      aria-label={t("emailTemplates.ui.blockSettings")}
    >
      <EmailTemplateOutline
        blocks={blocks}
        selectedBlockIndex={selectedBlockIndex}
        onSelectBlock={onSelectBlock}
        onRemoveBlock={onRemoveBlock}
        disabled={disabled}
      />
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h5 className="text-sm font-semibold">{t("emailTemplates.ui.blockSettings")}</h5>
          {block && (
            <span className="text-xs text-neutral-500">
              {t(`emailTemplates.ui.blocks.${block.type}`)}
            </span>
          )}
        </div>
        {block && (
          <EmailTemplateBlockSettings
            block={block}
            variables={variables}
            disabled={disabled}
            onChange={onChange}
            onUpload={onUpload}
          />
        )}
      </section>
    </aside>
  );
}
