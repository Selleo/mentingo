import { BookmarkPlus, ChevronDown, FolderOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";

import type { ListReportConfigurationsResponse } from "~/api/generated-api";

type SavedConfiguration = ListReportConfigurationsResponse["data"][number];

type ReportSavedConfigurationsProps = {
  configurations: SavedConfiguration[];
  isLoading: boolean;
  activeConfigurationId?: string;
  canManageShared: boolean;
  onOpen: (configuration: SavedConfiguration) => void;
  onDelete: (configuration: SavedConfiguration) => void;
  onSaveCurrent: () => void;
};

export function ReportSavedConfigurations({
  configurations,
  isLoading,
  activeConfigurationId,
  canManageShared,
  onOpen,
  onDelete,
  onSaveCurrent,
}: ReportSavedConfigurationsProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="gap-2">
          <FolderOpen className="size-4" />
          {t("reports.saved.title")}
          {configurations.length > 0 && (
            <span className="details-md rounded-full bg-primary-50 px-1.5 text-primary-800">
              {configurations.length}
            </span>
          )}
          <ChevronDown className="size-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="max-h-80 overflow-y-auto p-2">
          {isLoading && <Skeleton className="h-16 w-full rounded-lg" />}
          {!isLoading && !configurations.length && (
            <p className="body-sm px-2 py-6 text-center text-neutral-500">
              {t("reports.saved.empty")}
            </p>
          )}
          {!isLoading &&
            configurations.map((saved) => {
              const isAvailable = "isAvailable" in saved ? saved.isAvailable : true;
              const canDelete = saved.visibility === "personal" || canManageShared;
              return (
                <div
                  key={saved.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-md pr-1 hover:bg-neutral-50",
                    activeConfigurationId === saved.id && "bg-primary-50 hover:bg-primary-50",
                  )}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-2 py-2 text-left"
                    onClick={() => {
                      onOpen(saved);
                      setIsOpen(false);
                    }}
                  >
                    <span className="body-sm-md block truncate text-neutral-950">{saved.name}</span>
                    <span className="details block truncate text-neutral-500">
                      {t(`reports.saved.${saved.visibility}`)} ·{" "}
                      {t(`reports.views.${saved.query.view}`)}
                    </span>
                  </button>
                  {!isAvailable && (
                    <span className="details-md shrink-0 rounded-full bg-warning-100 px-2 text-warning-800">
                      {t("reports.saved.unavailable")}
                    </span>
                  )}
                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-neutral-500 hover:text-error-700"
                      aria-label={t("reports.saved.delete", { name: saved.name })}
                      onClick={() => onDelete(saved)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              );
            })}
        </div>
        <div className="border-t border-neutral-100 p-2">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => {
              setIsOpen(false);
              onSaveCurrent();
            }}
          >
            <BookmarkPlus className="size-4" />
            {t("reports.saved.saveConfiguration")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
