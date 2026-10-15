import {
  AUTOMATION_EMAIL_BRANCH_PLANS,
  getAncestorConditionOutcomes,
  isAutomationFieldAvailable,
  AUTOMATION_MAPPING_TYPES,
  AUTOMATION_RECIPIENT_TYPES,
} from "@repo/shared";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";

import { getSelectableAutomationVariables } from "../utils/selectableVariables";
import { serializeAutomationTemplateReference } from "../utils/templateReference";

import { AutomationSearchSelect } from "./AutomationSearchSelect";
import { BranchVariables } from "./BranchVariables";
import { EmailRecipientsSettings } from "./EmailRecipientsSettings";
import { PlaceholderMappingField } from "./PlaceholderMappingField";

import type { AutomationTemplateOption } from "../../automations.types";
import type {
  AutomationEventDefinition,
  AutomationSendEmailStep,
  AutomationPlaceholderMapping,
  AutomationWorkflow,
} from "@repo/shared";

interface EmailActionSettingsProps {
  node: AutomationSendEmailStep;
  workflow: AutomationWorkflow;
  event?: AutomationEventDefinition;
  templates: AutomationTemplateOption[];
  readonly: boolean;
  loadingTemplates: boolean;
  onValidityChange: (valid: boolean) => void;
  onChange: (step: AutomationSendEmailStep) => void;
}

export function EmailActionSettings({
  node,
  workflow,
  event,
  templates,
  readonly,
  loadingTemplates,
  onValidityChange,
  onChange,
}: EmailActionSettingsProps) {
  const { t } = useTranslation();
  const config = node.config;
  const selectedTemplate = templates.find(
    (template) =>
      config.template &&
      serializeAutomationTemplateReference(template.reference) ===
        serializeAutomationTemplateReference(config.template),
  );
  const facts = event ? getAncestorConditionOutcomes(workflow, node.id, event) : {};
  const variables = getSelectableAutomationVariables(event).filter(
    (variable) => !event || isAutomationFieldAvailable(event, variable.key, facts),
  );
  const [invalidPlaceholders, setInvalidPlaceholders] = useState<Set<string>>(() => new Set());

  const recipients = config.recipients;
  const hasSelectedRecipients = match(recipients)
    .with({ type: AUTOMATION_RECIPIENT_TYPES.USER }, (selection) => Boolean(selection.userId))
    .with({ type: AUTOMATION_RECIPIENT_TYPES.GROUP }, (selection) => Boolean(selection.groupId))
    .with({ type: AUTOMATION_RECIPIENT_TYPES.ROLE }, (selection) => Boolean(selection.roleId))
    .otherwise(() => true);
  const hasAccountActionLinks = Object.values(config.mappings ?? {}).some(
    (mapping) =>
      mapping.type === AUTOMATION_MAPPING_TYPES.EVENT_FIELD &&
      event?.fields.some(
        (field) => field.key === mapping.field && field.sensitivity === "account_action_link",
      ),
  );
  const hasValidRecipients =
    hasSelectedRecipients &&
    (!hasAccountActionLinks || !recipients || recipients.type === AUTOMATION_RECIPIENT_TYPES.EVENT);

  useEffect(() => {
    onValidityChange(invalidPlaceholders.size === 0 && hasValidRecipients);
  }, [invalidPlaceholders, hasValidRecipients, onValidityChange]);

  useEffect(() => () => onValidityChange(true), [onValidityChange]);

  function changeTemplate(value: string) {
    onChange({
      ...node,
      config: {
        ...config,
        template: templates.find(
          (template) => serializeAutomationTemplateReference(template.reference) === value,
        )?.reference,
        mappings: {},
      },
    });
    setInvalidPlaceholders(new Set());
  }

  function updateValidity(name: string, valid: boolean) {
    setInvalidPlaceholders((current) => {
      const invalid = new Set(current);

      if (valid) invalid.delete(name);
      else invalid.add(name);

      return invalid;
    });
  }

  function setMapping(name: string, mapping: AutomationPlaceholderMapping) {
    onChange({ ...node, config: { ...config, mappings: { ...config.mappings, [name]: mapping } } });
  }

  return (
    <div className="space-y-6">
      <fieldset disabled={readonly} className="min-w-0 space-y-4">
        <div>
          <div className="space-y-2">
            <Label>{t("automationBuilder.editAction.emailTemplate")}</Label>
            <AutomationSearchSelect
              label={t("automationBuilder.editAction.emailTemplate")}
              placeholder={t("automationBuilder.editAction.selectTemplate")}
              disabled={readonly || loadingTemplates}
              value={config.template ? serializeAutomationTemplateReference(config.template) : ""}
              onValueChange={changeTemplate}
              groups={(["builtin", "custom"] as const).map((type) => ({
                label: t(
                  type === "builtin"
                    ? "automationBuilder.editAction.defaultTemplatesGroup"
                    : "automationBuilder.editAction.customTemplatesGroup",
                ),
                options: templates
                  .filter(
                    (item) =>
                      item.reference.type === type &&
                      (item.reference.type !== "builtin" ||
                        !(item.reference.key in AUTOMATION_EMAIL_BRANCH_PLANS) ||
                        (config.template &&
                          serializeAutomationTemplateReference(item.reference) ===
                            serializeAutomationTemplateReference(config.template))),
                  )
                  .map((item) => ({
                    value: serializeAutomationTemplateReference(item.reference),
                    label:
                      item.reference.type === "builtin"
                        ? t(`emailTemplates.events.${item.reference.key}`, {
                            defaultValue: item.name,
                          })
                        : item.name,
                  })),
              }))}
            />
          </div>
          <Separator className="-mx-4 my-5 w-[calc(100%+2rem)]" />
          <div>
            <EmailRecipientsSettings
              recipients={config.recipients}
              event={event}
              disabled={readonly}
              hasAccountActionLinks={hasAccountActionLinks}
              onChange={(recipients) => onChange({ ...node, config: { ...config, recipients } })}
            />
          </div>
        </div>
      </fieldset>
      <Separator className="-mx-4 w-[calc(100%+2rem)]" />
      {event && Object.keys(facts).length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {t("automationBuilder.branchVariables.available")}
          </summary>
          <div className="mt-3">
            <BranchVariables event={event} facts={facts} />
          </div>
        </details>
      )}
      <fieldset disabled={readonly} className="min-w-0 space-y-3">
        <h3 className="text-sm font-semibold">{t("automationBuilder.mapping.title")}</h3>
        {!selectedTemplate && (
          <p className="text-sm text-muted-foreground">
            {t("automationBuilder.editAction.selectTemplateFirst")}
          </p>
        )}
        {selectedTemplate?.placeholders.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {t("automationBuilder.editAction.noPlaceholders")}
          </p>
        )}
        {!!selectedTemplate?.placeholders.length && (
          <div className="space-y-5">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("automationBuilder.mapping.description")}
            </p>
            {selectedTemplate.placeholders.map((placeholder) => (
              <PlaceholderMappingField
                key={`${config.template ? serializeAutomationTemplateReference(config.template) : ""}:${placeholder.name}`}
                event={event}
                placeholder={placeholder}
                mapping={config.mappings?.[placeholder.name]}
                variables={variables}
                readonly={readonly}
                onChange={(mapping) => setMapping(placeholder.name, mapping)}
                onValidityChange={(valid) => updateValidity(placeholder.name, valid)}
              />
            ))}
          </div>
        )}
        {!!selectedTemplate && variables.length === 0 && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">
              {t("automationBuilder.editAction.noTriggerVariables")}
            </p>
          </div>
        )}
      </fieldset>
    </div>
  );
}
