import {
  getCanonicalAutomationField,
  AUTOMATION_MAPPING_TYPES,
  AUTOMATION_PLACEHOLDER_TYPES,
} from "@repo/shared";
import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";

import { StaticMappingInput } from "../../StaticMappingInput";

import { AutomationSearchSelect } from "./AutomationSearchSelect";

import type {
  AutomationEventDefinition,
  AutomationPlaceholderDefinition,
  AutomationPlaceholderMapping,
  AutomationProvidedVariable,
} from "@repo/shared";

interface PlaceholderMappingFieldProps {
  event?: AutomationEventDefinition;
  placeholder: AutomationPlaceholderDefinition;
  mapping?: AutomationPlaceholderMapping;
  variables: AutomationProvidedVariable[];
  readonly: boolean;
  onChange: (mapping: AutomationPlaceholderMapping) => void;
  onValidityChange: (valid: boolean) => void;
}

function getMappingSelection(
  mapping: AutomationPlaceholderMapping | undefined,
  variables: AutomationProvidedVariable[],
  event?: AutomationEventDefinition,
) {
  if (!mapping) return "";
  if (mapping.type === AUTOMATION_MAPPING_TYPES.STATIC) return AUTOMATION_MAPPING_TYPES.STATIC;

  const field = event ? getCanonicalAutomationField(event, mapping.field) : mapping.field;
  return variables.find((variable) => variable.sourceKey === field)?.key ?? mapping.field;
}

export function PlaceholderMappingField({
  event,
  placeholder,
  mapping,
  variables,
  readonly,
  onChange,
  onValidityChange,
}: PlaceholderMappingFieldProps) {
  const { t } = useTranslation();
  const matchingVariables = variables.filter(
    (variable) =>
      variable.dataType === placeholder.type ||
      (placeholder.type === AUTOMATION_PLACEHOLDER_TYPES.STRING &&
        variable.dataType === AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING),
  );
  const selection = getMappingSelection(mapping, variables, event);
  const hasUnavailableVariable =
    mapping?.type === AUTOMATION_MAPPING_TYPES.EVENT_FIELD &&
    !matchingVariables.some((variable) => variable.key === selection);

  const selectedVariable = matchingVariables.find((variable) => variable.key === selection);
  const exampleValue = selectedVariable?.sampleValue;
  const hasExample =
    typeof exampleValue === "string" ||
    typeof exampleValue === "number" ||
    typeof exampleValue === "boolean";

  function changeMapping(value: string) {
    onValidityChange(true);

    if (value === AUTOMATION_MAPPING_TYPES.STATIC) {
      onChange({ type: AUTOMATION_MAPPING_TYPES.STATIC, value: placeholder.sampleValue });
      return;
    }

    onChange({ type: AUTOMATION_MAPPING_TYPES.EVENT_FIELD, field: value });
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <h4 className="text-sm font-medium text-neutral-950">
            {placeholder.label || placeholder.name}
          </h4>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 rounded text-neutral-400 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${placeholder.label || placeholder.name} · {{${placeholder.name}}}`}
                >
                  <Info className="size-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs space-y-1">
                <code className="break-all text-xs">{`{{${placeholder.name}}}`}</code>
                {placeholder.description && (
                  <p className="text-xs text-muted-foreground">{placeholder.description}</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <AutomationSearchSelect
        label={placeholder.label || placeholder.name}
        placeholder={t("automationBuilder.mapping.chooseValue")}
        disabled={readonly}
        value={selection}
        onValueChange={changeMapping}
        groups={[
          {
            label: t("automationBuilder.mapping.fromTrigger"),
            options: [
              ...(hasUnavailableVariable
                ? [
                    {
                      value: selection,
                      label: t("automationBuilder.editAction.unavailableVariable"),
                      description: selection,
                      disabled: true,
                    },
                  ]
                : []),
              ...matchingVariables.map((variable) => ({
                value: variable.key,
                label: variable.labelKey
                  ? t(variable.labelKey, { defaultValue: variable.label })
                  : variable.label,
                description: `{{${variable.key}}}`,
              })),
            ],
          },
          {
            label: t("automationBuilder.mapping.customValue"),
            options: [
              {
                value: AUTOMATION_MAPPING_TYPES.STATIC,
                label: t("automationBuilder.mapping.fixedValue"),
              },
            ],
          },
        ]}
      />
      {hasUnavailableVariable && (
        <p role="alert" className="text-xs text-amber-700">
          {t("automationBuilder.mapping.unavailable")}
        </p>
      )}
      {selectedVariable && hasExample && (
        <p className="truncate text-xs text-neutral-500" title={String(exampleValue)}>
          {t("automationBuilder.mapping.example")}: {String(exampleValue)}
        </p>
      )}
      {mapping?.type === AUTOMATION_MAPPING_TYPES.STATIC && (
        <div className="space-y-2">
          <StaticMappingInput
            placeholder={placeholder}
            value={mapping.value}
            onChange={(value) => onChange({ type: AUTOMATION_MAPPING_TYPES.STATIC, value })}
            onValidityChange={onValidityChange}
          />
        </div>
      )}
    </div>
  );
}
