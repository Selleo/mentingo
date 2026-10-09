import { isAutomationFieldAvailable } from "@repo/shared";
import { Variable } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Table, TableBody, TableRow, TableCell } from "~/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { getSelectableAutomationVariables } from "../utils/selectableVariables";

import type { AutomationEventDefinition, AutomationProvidedVariable } from "@repo/shared";

export function BranchVariables({
  event,
  facts,
}: {
  event: AutomationEventDefinition;
  facts: Record<string, boolean>;
}) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const variables = getSelectableAutomationVariables(event);
  const available = variables.filter((variable) =>
    isAutomationFieldAvailable(event, variable.key, facts),
  );
  const unavailable = variables.filter(
    (variable) => !isAutomationFieldAvailable(event, variable.key, facts),
  );

  function renderTag(variable: AutomationProvidedVariable, unavailable = false) {
    const label = t(variable.labelKey ?? variable.label, { defaultValue: variable.label });
    const value = variable.sampleValue;
    let example = value;
    if (value && typeof value === "object" && !Array.isArray(value))
      example = value[language] ?? value.en;
    const exampleText =
      typeof example === "object" ? JSON.stringify(example) : String(example ?? "");
    return (
      <Tooltip key={variable.key}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              "flex w-full min-h-8 min-w-0 text-left items-center gap-2 bg-transparent px-4 py-2 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-ring",
              { "text-neutral-400": unavailable },
            )}
          >
            <Variable className="size-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
            <code
              className={cn("break-all text-[11px] text-primary-800", {
                "text-neutral-400": unavailable,
              })}
            >{`{{ ${variable.key} }}`}</code>
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs space-y-1 text-xs">
          <p className="font-medium">{label}</p>
          {unavailable ? (
            <p>{t("automationBuilder.branchVariables.unavailable")}</p>
          ) : (
            exampleText && (
              <p>
                {t("automationBuilder.mapping.example")}: {exampleText}
              </p>
            )
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Table aria-label={t("emailTemplates.ui.variables")}>
        {[
          { key: "available", variables: available },
          { key: "unavailable", variables: unavailable },
        ].map((group) => (
          <TableBody key={group.key}>
            <TableRow className="border-y bg-neutral-50 hover:bg-neutral-50">
              <th
                scope="rowgroup"
                className="px-4 py-2 text-left text-xs font-medium text-neutral-500"
              >
                {t(`automationBuilder.branchVariables.${group.key}`)}
              </th>
            </TableRow>
            {group.variables.map((variable) => (
              <TableRow key={variable.key} className="hover:bg-neutral-50">
                <TableCell className="p-0">
                  {renderTag(variable, group.key === "unavailable")}
                </TableCell>
              </TableRow>
            ))}
            {group.variables.length === 0 && (
              <TableRow>
                <TableCell className="px-4 py-2 text-xs text-neutral-400">—</TableCell>
              </TableRow>
            )}
          </TableBody>
        ))}
      </Table>
    </TooltipProvider>
  );
}
