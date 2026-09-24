import { Search, Variable } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import {
  EMAIL_TEMPLATE_BLOCK_OPTIONS,
  EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE,
} from "../emailTemplates.constants";

import { EmailTemplateBlockPalette } from "./EmailTemplateBlockPalette";
import { EmailTemplateVariableDescription } from "./EmailTemplateVariableDescription";

import type { EmailTemplateBlock, EmailTemplateVariables } from "../emailTemplates.types";

export type EmailTemplateBlockSidebarProps = {
  variables: EmailTemplateVariables;
  disabled: boolean;
  hidden: boolean;
  onInsertBlock: (type: EmailTemplateBlock["type"]) => void;
  onInsertVariable: (token: string) => void;
};

export function EmailTemplateBlockSidebar({
  variables,
  disabled,
  hidden,
  onInsertBlock,
  onInsertVariable,
}: EmailTemplateBlockSidebarProps) {
  const { t } = useTranslation();
  const [variableSearch, setVariableSearch] = useState("");
  const filteredVariables = variables.filter((variable) =>
    variable.key.toLowerCase().includes(variableSearch.toLowerCase()),
  );
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
      <div className="space-y-3">
        <h5 className="text-sm font-semibold">{t("emailTemplates.ui.variables")}</h5>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-3 size-4 text-neutral-400" />
          <Input
            data-testid={EMAIL_TEMPLATES_HANDLES.VARIABLE_SEARCH}
            value={variableSearch}
            onChange={(e) => setVariableSearch(e.target.value)}
            className="pl-8"
            placeholder={t("emailTemplates.ui.searchVariables")}
            aria-label={t("emailTemplates.ui.searchVariables")}
          />
        </div>
        <div className="space-y-1.5 overflow-x-auto pb-1">
          {filteredVariables.map((variable) => (
            <div key={variable.key} className="space-y-1">
              <Button
                data-testid={EMAIL_TEMPLATES_HANDLES.VARIABLE(variable.key)}
                draggable={!disabled}
                onDragStart={(event) => {
                  event.dataTransfer.setData(EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE, variable.key);
                  event.dataTransfer.setData("text/plain", `{{ ${variable.key} }}`);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="h-auto w-max min-w-full justify-start whitespace-nowrap px-2 py-1.5 text-left font-mono text-[11px]"
                title={
                  typeof variable.sampleValue === "object"
                    ? t("emailTemplates.ui.collectionSample")
                    : String(variable.sampleValue)
                }
                onClick={() => onInsertVariable(`{{ ${variable.key} }}`)}
              >
                <Variable className="mr-2 size-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
                {`{{ ${variable.key} }}`}
                {variable.requiredInTemplate && (
                  <span aria-label={t("emailTemplates.ui.requiredLink")}> *</span>
                )}
              </Button>
              <EmailTemplateVariableDescription variableKey={variable.key} />
            </div>
          ))}
          {!filteredVariables.length && (
            <p className="text-xs text-neutral-500">{t("emailTemplates.ui.noVariables")}</p>
          )}
        </div>
      </div>
    </aside>
  );
}
