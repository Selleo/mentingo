import { AUTOMATION_RECIPIENT_TYPES } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { useAutomationRecipientOptions } from "~/api/queries/useAutomationRecipientOptions";

interface GroupConditionLabelProps {
  groupId: string;
  fallbackLabel: string;
}

export function GroupConditionLabel({ groupId, fallbackLabel }: GroupConditionLabelProps) {
  const { t } = useTranslation();
  const { data } = useAutomationRecipientOptions({
    type: AUTOMATION_RECIPIENT_TYPES.GROUP,
    id: groupId,
  });
  const groupName = data?.data.find((option) => option.id === groupId)?.label;

  if (!groupName) return <>{fallbackLabel}</>;

  return (
    <>
      {fallbackLabel}{" "}
      <span className="text-xs font-normal text-neutral-700">
        {t("automationBuilder.condition.groupIs", { group: groupName })}
      </span>
    </>
  );
}
