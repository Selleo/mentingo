import { AUTOMATION_RECIPIENT_TYPES } from "@repo/shared";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Label } from "~/components/ui/label";

import { AutomationRecipientPicker } from "./AutomationRecipientPicker";
import { AutomationSearchSelect } from "./AutomationSearchSelect";

import type { AutomationEventDefinition, AutomationRecipientSelection } from "@repo/shared";

interface EmailRecipientsSettingsProps {
  recipients?: AutomationRecipientSelection;
  event?: AutomationEventDefinition;
  disabled: boolean;
  hasAccountActionLinks: boolean;
  onChange: (recipients: AutomationRecipientSelection) => void;
}

export function EmailRecipientsSettings({
  recipients = { type: AUTOMATION_RECIPIENT_TYPES.EVENT },
  event,
  disabled,
  hasAccountActionLinks,
  onChange,
}: EmailRecipientsSettingsProps) {
  const { t } = useTranslation();
  const availableRecipientTypes = hasAccountActionLinks
    ? [AUTOMATION_RECIPIENT_TYPES.EVENT]
    : Object.values(AUTOMATION_RECIPIENT_TYPES);

  const selectedId = match(recipients)
    .with({ type: AUTOMATION_RECIPIENT_TYPES.USER }, (selection) => selection.userId)
    .with({ type: AUTOMATION_RECIPIENT_TYPES.GROUP }, (selection) => selection.groupId)
    .with({ type: AUTOMATION_RECIPIENT_TYPES.ROLE }, (selection) => selection.roleId)
    .otherwise(() => "");

  function selectRecipients(type: string, id = "") {
    const selection = match(type)
      .with(AUTOMATION_RECIPIENT_TYPES.USER, () => ({
        type: AUTOMATION_RECIPIENT_TYPES.USER,
        userId: id,
      }))
      .with(AUTOMATION_RECIPIENT_TYPES.GROUP, () => ({
        type: AUTOMATION_RECIPIENT_TYPES.GROUP,
        groupId: id,
      }))
      .with(AUTOMATION_RECIPIENT_TYPES.ROLE, () => ({
        type: AUTOMATION_RECIPIENT_TYPES.ROLE,
        roleId: id,
      }))
      .with(AUTOMATION_RECIPIENT_TYPES.EVERYONE, () => ({
        type: AUTOMATION_RECIPIENT_TYPES.EVERYONE,
      }))
      .otherwise(() => ({ type: AUTOMATION_RECIPIENT_TYPES.EVENT }));

    onChange(selection);
  }

  return (
    <div className="space-y-2">
      <Label>{t("automationBuilder.recipients.title")}</Label>
      <AutomationSearchSelect
        label={t("automationBuilder.recipients.title")}
        placeholder={t("automationBuilder.recipients.title")}
        value={recipients.type}
        disabled={disabled}
        onValueChange={(type) => {
          if (type !== recipients.type) selectRecipients(type);
        }}
        groups={[
          {
            options: availableRecipientTypes.map((type) => ({
              value: type,
              label: t(`automationBuilder.recipients.${type}`),
            })),
          },
        ]}
      />
      {recipients.type === AUTOMATION_RECIPIENT_TYPES.EVENT && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {event
            ? t(`automationBuilder.recipients.eventDescriptions.${event.kind}`)
            : t("automationBuilder.recipients.selectTrigger")}
        </p>
      )}
      {recipients.type === AUTOMATION_RECIPIENT_TYPES.EVERYONE && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("automationBuilder.recipients.everyoneHint")}
        </p>
      )}
      {recipients.type !== AUTOMATION_RECIPIENT_TYPES.EVENT &&
        recipients.type !== AUTOMATION_RECIPIENT_TYPES.EVERYONE && (
          <AutomationRecipientPicker
            key={recipients.type}
            type={recipients.type}
            value={selectedId}
            disabled={disabled || hasAccountActionLinks}
            onChange={(id) => selectRecipients(recipients.type, id)}
          />
        )}
      {hasAccountActionLinks && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("automationBuilder.recipients.accountLinkRestriction")}
        </p>
      )}
    </div>
  );
}
