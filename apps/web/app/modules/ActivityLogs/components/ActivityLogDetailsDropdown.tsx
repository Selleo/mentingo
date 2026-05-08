import { MoreVertical } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";

import {
  getActivityLogDetailSections,
  type ActivityLogMetadataPayload,
} from "../activityLogs.utils";

type ActivityLogDetailsDropdownProps = {
  metadata: ActivityLogMetadataPayload | null | undefined;
};

const renderValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return <span className="text-neutral-400">-</span>;
  }

  if (typeof value === "object") {
    return (
      <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-neutral-900">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <span className="text-sm text-neutral-900">{String(value)}</span>;
};

export const ActivityLogDetailsDropdown = ({ metadata }: ActivityLogDetailsDropdownProps) => {
  const { t } = useTranslation();
  const sections = getActivityLogDetailSections(metadata);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-9 rounded-lg border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
          aria-label={t("activityLogsView.table.showDetails")}
        >
          <MoreVertical className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[360px] rounded-xl border bg-white p-0"
      >
        <div className="border-b border-neutral-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
            {t("activityLogsView.table.details")}
          </p>
        </div>

        <div className="max-h-[24rem] overflow-y-auto p-3">
          {sections.length === 0 ? (
            <p className="px-1 py-2 text-sm text-neutral-500">
              {t("activityLogsView.details.noMetadata")}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {sections.map((section) => (
                <div
                  key={section.key}
                  className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                >
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    {t(`activityLogsView.details.${section.key}`)}
                  </div>
                  <div
                    className={cn(
                      typeof section.value === "object" &&
                        section.value !== null &&
                        "overflow-x-auto",
                    )}
                  >
                    {renderValue(section.value)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
