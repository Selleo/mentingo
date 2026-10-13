import { getAncestorConditionOutcomes, getCanonicalAutomationField } from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "~/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";

import { getBooleanConditionFieldOptions } from "../utils/conditionFields";

import { AutomationSearchSelect } from "./AutomationSearchSelect";
import { BranchVariables } from "./BranchVariables";

import type {
  AutomationConditionStep,
  AutomationEventDefinition,
  AutomationWorkflow,
} from "@repo/shared";

export function ConditionSettings({
  node,
  workflow,
  branchPosition,
  event,
  disabled,
  onChange,
}: {
  node: AutomationConditionStep;
  workflow: AutomationWorkflow;
  branchPosition?: number;
  event?: AutomationEventDefinition;
  disabled: boolean;
  onChange: (node: AutomationConditionStep) => void;
}) {
  const { t } = useTranslation();
  const fields = getBooleanConditionFieldOptions(event);
  const [position, setPosition] = useState(branchPosition ?? 0);
  const facts = event ? getAncestorConditionOutcomes(workflow, node.id, event) : {};
  if (event && node.config.field)
    facts[getCanonicalAutomationField(event, node.config.field)] = position === 0;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t("automationBuilder.condition.title")}</Label>
        <AutomationSearchSelect
          label={t("automationBuilder.condition.field")}
          placeholder={t("automationBuilder.condition.field")}
          value={
            fields.find(
              (field) =>
                event &&
                getCanonicalAutomationField(event, field.key) ===
                  getCanonicalAutomationField(event, node.config.field ?? ""),
            )?.key ??
            node.config.field ??
            ""
          }
          disabled={disabled || !fields.length}
          onValueChange={(field) => onChange({ ...node, config: { field } })}
          groups={[
            {
              options: fields.map((field) => ({
                value: field.key,
                label: t(field.labelKey, { defaultValue: field.label }),
              })),
            },
          ]}
        />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t(
          fields.length
            ? "automationBuilder.condition.hint"
            : "automationBuilder.condition.noFields",
        )}
      </p>
      {event && node.config.field && (
        <Tabs
          value={String(position)}
          onValueChange={(value) => setPosition(Number(value))}
          className="-mx-4 w-[calc(100%+2rem)] border-t"
        >
          <div className="border-b">
            <TabsList
              aria-label={t("automationBuilder.condition.title")}
              className="h-auto w-full justify-start gap-2 rounded-none bg-transparent p-0"
            >
              {[0, 1].map((value) => (
                <TabsTrigger
                  key={value}
                  value={String(value)}
                  className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary-600 data-[state=active]:bg-transparent data-[state=active]:text-primary-700 data-[state=active]:shadow-none"
                >
                  {t(
                    value === 0
                      ? "automationBuilder.condition.yes"
                      : "automationBuilder.condition.no",
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          {[0, 1].map((value) => (
            <TabsContent key={value} value={String(value)} className="m-0">
              <BranchVariables event={event} facts={facts} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
