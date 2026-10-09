import {
  AUTOMATION_PLACEHOLDER_TYPES,
  AUTOMATION_RESERVED_BRANDING_PLACEHOLDER,
} from "@repo/shared";
import { Check, Info, Pencil, Plus, Search, Trash2, Variable } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { EMAIL_TEMPLATES_HANDLES } from "../../../../../e2e/data/email-templates/handles";
import { EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE } from "../emailTemplates.constants";

import type { EmailTemplateVariables } from "../emailTemplates.types";
import type { AutomationPlaceholderDefinition } from "@repo/shared";

interface EmailTemplatePlaceholdersProps {
  value?: AutomationPlaceholderDefinition[];
  variables: EmailTemplateVariables;
  onChange?: (value: AutomationPlaceholderDefinition[]) => void;
  onInsertVariable: (token: string) => void;
  disabled: boolean;
}

export function EmailTemplatePlaceholders({
  value = [],
  variables,
  onChange,
  onInsertVariable,
  disabled,
}: EmailTemplatePlaceholdersProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const [search, setSearch] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const focusNameInput = useCallback((input: HTMLInputElement | null) => input?.focus(), []);
  const canEdit = !disabled && Boolean(onChange);
  const filteredVariables = variables.filter((variable) =>
    variable.key.toLowerCase().includes(search.toLowerCase()),
  );

  function getExampleValue(variable: EmailTemplateVariables[number]) {
    const sample =
      value.find((item) => item.name === variable.key)?.sampleValue ?? variable.sampleValue;

    if (sample === null || sample === "") return "";
    if (typeof sample !== "object") return String(sample);

    if (!Array.isArray(sample)) {
      const translation = sample[language] ?? sample.en;

      if (typeof translation === "string") return translation;
    }

    return JSON.stringify(sample);
  }

  function updatePlaceholder(index: number, patch: Partial<AutomationPlaceholderDefinition>) {
    onChange?.(
      value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  function addPlaceholder() {
    let number = value.length + 1;

    while (value.some((item) => item.name === `placeholder_${number}`)) number += 1;

    setSearch("");
    setEditingIndex(value.length);
    onChange?.([
      ...value,
      {
        name: `placeholder_${number}`,
        label: "",
        type: AUTOMATION_PLACEHOLDER_TYPES.STRING,
        required: false,
        sampleValue: "",
      },
    ]);
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-1.5">
        <h5 className="text-sm font-semibold">{t("emailTemplates.ui.variables")}</h5>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t("emailTemplates.ui.placeholdersHelp.title")}
                className="flex size-6 items-center justify-center rounded text-neutral-500 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Info className="size-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="start"
              className="max-w-sm space-y-3 p-4 text-xs leading-relaxed"
            >
              <p className="font-semibold">{t("emailTemplates.ui.placeholdersHelp.title")}</p>
              <p>{t("emailTemplates.ui.placeholdersHelp.description")}</p>
              <div className="space-y-1 rounded bg-neutral-50 p-2 font-mono text-[11px]">
                <p>{t("emailTemplates.ui.placeholdersHelp.nameExample", { token: "{{name}}" })}</p>
                <p>
                  {t("emailTemplates.ui.placeholdersHelp.courseExample", {
                    token: "{{course_name}}",
                  })}
                </p>
              </div>
              <p>{t("emailTemplates.ui.placeholdersHelp.setup")}</p>
              <p className="text-neutral-500">{t("emailTemplates.ui.placeholdersHelp.preview")}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p className="text-xs leading-relaxed text-neutral-500">
        {t("emailTemplates.ui.tagMappingHint")}
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-3 size-4 text-neutral-400" />
        <Input
          data-testid={EMAIL_TEMPLATES_HANDLES.VARIABLE_SEARCH}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setEditingIndex(null);
          }}
          className="pl-8"
          placeholder={t("emailTemplates.ui.searchVariables")}
          aria-label={t("emailTemplates.ui.searchVariables")}
        />
      </div>
      <TooltipProvider delayDuration={200}>
        <div className="space-y-1.5">
          {filteredVariables.map((variable, variableIndex) => {
            const index = value.findIndex((item) => item.name === variable.key);
            const editable =
              canEdit && index >= 0 && variable.key !== AUTOMATION_RESERVED_BRANDING_PLACEHOLDER;
            const isEditing = editable && editingIndex === index;
            const example = getExampleValue(variable);

            return (
              <div
                key={variableIndex}
                className="group rounded-lg border bg-white hover:border-primary-300"
              >
                {isEditing ? (
                  <div className="flex h-8 min-w-0 items-center">
                    <div className="flex min-w-0 flex-1 items-center px-2 font-mono text-[11px] text-primary-800">
                      <Variable
                        className="mr-2 size-3.5 shrink-0 text-neutral-500"
                        aria-hidden="true"
                      />
                      <span className="shrink-0" aria-hidden="true">
                        {"{{ "}
                      </span>
                      <Input
                        ref={focusNameInput}
                        aria-label={t("emailTemplates.ui.placeholderName")}
                        className="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 py-0 font-mono text-[11px] text-primary-800 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                        value={variable.key}
                        onChange={(event) => updatePlaceholder(index, { name: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === "Escape") {
                            event.preventDefault();
                            setEditingIndex(null);
                          }
                        }}
                      />
                      <span className="shrink-0" aria-hidden="true">
                        {" }}"}
                      </span>
                    </div>
                    <div className="flex shrink-0 pr-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-neutral-500"
                        aria-label={t("common.button.close")}
                        onClick={() => setEditingIndex(null)}
                      >
                        <Check className="size-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-neutral-500 hover:bg-error-50 hover:text-error-700"
                        aria-label={`${t("emailTemplates.ui.removePlaceholder")}: ${variable.key}`}
                        onClick={() => {
                          setEditingIndex(null);
                          onChange?.(value.filter((_, itemIndex) => itemIndex !== index));
                        }}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          data-testid={EMAIL_TEMPLATES_HANDLES.VARIABLE(variable.key)}
                          type="button"
                          draggable={!disabled}
                          onDragStart={(event) => {
                            event.dataTransfer.setData(
                              EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE,
                              variable.key,
                            );
                            event.dataTransfer.setData("text/plain", `{{ ${variable.key} }}`);
                            event.dataTransfer.effectAllowed = "copy";
                          }}
                          aria-disabled={disabled}
                          className={cn(
                            "flex h-8 min-w-0 flex-1 items-center rounded-lg px-2 text-left font-mono text-[11px] text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            disabled && "cursor-default opacity-50",
                          )}
                          onClick={() => {
                            if (!disabled) onInsertVariable(`{{ ${variable.key} }}`);
                          }}
                        >
                          <Variable
                            className="mr-2 size-3.5 shrink-0 text-neutral-500"
                            aria-hidden="true"
                          />
                          <span className="truncate">{`{{ ${variable.key} }}`}</span>
                        </button>
                      </TooltipTrigger>
                      {example && (
                        <TooltipContent align="start" className="max-w-xs space-y-2 break-words">
                          <p className="font-mono text-xs">{`{{ ${variable.key} }}`}</p>
                          {example && (
                            <div>
                              <p className="text-xs text-muted-foreground">
                                {t("emailTemplates.ui.sampleValue")}
                              </p>
                              <p className="text-sm">{example}</p>
                            </div>
                          )}
                        </TooltipContent>
                      )}
                    </Tooltip>
                    {editable && (
                      <div className="flex shrink-0 pr-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-neutral-500"
                          aria-label={`${t("common.button.edit")}: ${variable.key}`}
                          onClick={() => setEditingIndex(index)}
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-neutral-500 hover:bg-error-50 hover:text-error-700"
                          aria-label={`${t("emailTemplates.ui.removePlaceholder")}: ${variable.key}`}
                          onClick={() => {
                            setEditingIndex(null);
                            onChange?.(value.filter((_, itemIndex) => itemIndex !== index));
                          }}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {!filteredVariables.length && (
            <p className="text-xs text-neutral-500">{t("emailTemplates.ui.noVariables")}</p>
          )}
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-full justify-start px-2 text-xs font-normal text-neutral-500"
              onClick={addPlaceholder}
            >
              <Plus className="mr-2 size-3.5" />
              {t("emailTemplates.ui.addPlaceholder")}
            </Button>
          )}
        </div>
      </TooltipProvider>
    </section>
  );
}
