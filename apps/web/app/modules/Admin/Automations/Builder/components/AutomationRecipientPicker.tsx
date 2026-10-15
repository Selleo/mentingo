import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAutomationRecipientOptions } from "~/api/queries/useAutomationRecipientOptions";
import { Button } from "~/components/ui/button";
import { useDebounce } from "~/hooks/useDebounce";

import { AutomationSearchSelect } from "./AutomationSearchSelect";

import type { AutomationRecipientOptionType } from "@repo/shared";

interface AutomationRecipientPickerProps {
  type: AutomationRecipientOptionType;
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}

const selectionLabelKeys = {
  user: "automationBuilder.recipients.selectUser",
  group: "automationBuilder.recipients.selectGroup",
  role: "automationBuilder.recipients.selectRole",
} as const;

export function AutomationRecipientPicker({
  type,
  value,
  disabled,
  onChange,
}: AutomationRecipientPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);
  const { data, isFetching, isError, refetch } = useAutomationRecipientOptions({
    type,
    search: debouncedSearch,
    page,
    perPage: 20,
  });
  const { data: selectedData, isPending: isLoadingSelection } = useAutomationRecipientOptions({
    type,
    id: value,
    enabled: Boolean(value),
  });
  const options = data?.data ?? [];
  const selected = selectedData?.data.find((option) => option.id === value);
  const selectedMissingFromPage = value && !options.some((option) => option.id === value);
  const selectionPlaceholder = isLoadingSelection
    ? t("automationBuilder.recipients.loading")
    : t("automationBuilder.recipients.unavailable");
  const displayedOptions = selectedMissingFromPage
    ? [selected ?? { id: value, label: selectionPlaceholder }, ...options]
    : options;
  const label = t(selectionLabelKeys[type]);
  const hasNextPage = Boolean(data && page * data.pagination.perPage < data.pagination.totalItems);

  return (
    <div className="space-y-2">
      <AutomationSearchSelect
        label={label}
        placeholder={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        searchValue={search}
        onSearchChange={(nextSearch) => {
          setSearch(nextSearch);
          setPage(1);
        }}
        emptyMessage={isFetching ? t("automationBuilder.recipients.loading") : undefined}
        groups={[
          {
            options: displayedOptions.map((option) => ({
              value: option.id,
              label: option.label,
              description: option.description,
            })),
          },
        ]}
        footer={
          (page > 1 || hasNextPage) && (
            <div className="flex justify-between border-t p-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={isFetching || page === 1}
                onClick={() => setPage((current) => current - 1)}
              >
                {t("pagination.previous")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isFetching || !hasNextPage}
                onClick={() => setPage((current) => current + 1)}
              >
                {t("pagination.next")}
              </Button>
            </div>
          )
        }
      />
      {isError && (
        <div role="alert" className="text-sm text-error-700">
          {t("automationBuilder.recipients.loadError")}
          <Button variant="link" size="sm" onClick={() => void refetch()}>
            {t("automations.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
