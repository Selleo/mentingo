import { Calendar, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

export type GroupDeadline = {
  deadline: string;
  id: string;
  name: string;
};

type DeadlineModalProps = {
  deadlineEnabledDraft: boolean;
  groupDeadlines: GroupDeadline[];
  isSaving: boolean;
  onChangeGroupDeadlines: (groups: GroupDeadline[]) => void;
  onClose: () => void;
  onSave: () => void;
  onToggleDeadline: () => void;
};

export default function DeadlineModal({
  deadlineEnabledDraft,
  groupDeadlines,
  isSaving,
  onChangeGroupDeadlines,
  onClose,
  onSave,
  onToggleDeadline,
}: DeadlineModalProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("modernCourseView.deadline.close")}
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl md:p-6">
        <div className="mb-4 flex items-center justify-between md:mb-6">
          <h3 className="font-gothic text-xl font-bold text-neutral-950 md:text-2xl">
            {t("modernCourseView.deadline.title")}
          </h3>
          <button type="button" onClick={onClose}>
            <X className="size-5 text-neutral-800 md:size-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div>
              <p className="font-semibold text-neutral-950">
                {t("modernCourseView.deadline.enable")}
              </p>
              <p className="text-sm text-neutral-800">
                {t("modernCourseView.deadline.enableDescription")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={deadlineEnabledDraft}
              disabled={groupDeadlines.length === 0}
              onClick={onToggleDeadline}
              className={cn("relative h-8 w-14 rounded-full transition-colors", {
                "cursor-not-allowed": groupDeadlines.length === 0,
                "bg-secondary-500": deadlineEnabledDraft,
                "bg-neutral-300": !deadlineEnabledDraft,
              })}
            >
              <div
                className={cn(
                  "absolute left-1 top-1 size-6 rounded-full bg-white transition-transform",
                  {
                    "translate-x-6": deadlineEnabledDraft,
                  },
                )}
              />
            </button>
          </div>

          {groupDeadlines.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {t("adminCourseView.deadlineNoAssignedGroups")}
            </p>
          )}

          {deadlineEnabledDraft &&
            groupDeadlines.map((group) => (
              <div
                key={group.id}
                className="flex flex-col items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <p className="font-semibold text-neutral-950">{group.name}</p>
                  <p className="text-sm text-neutral-800">
                    {t("modernCourseView.deadline.current", { deadline: group.deadline })}
                  </p>
                </div>
                <div className="relative w-full sm:w-48">
                  <input
                    type="date"
                    value={group.deadline}
                    onChange={(event) => {
                      const updated = groupDeadlines.map((currentGroup) =>
                        currentGroup.id === group.id
                          ? { ...currentGroup, deadline: event.target.value }
                          : currentGroup,
                      );
                      onChangeGroupDeadlines(updated);
                    }}
                    className="w-full rounded-lg border border-neutral-200 px-3 py-2 pr-10 text-sm [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                  />
                  <Calendar className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-neutral-800" />
                </div>
              </div>
            ))}
        </div>
        <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="order-2 w-full rounded-lg bg-neutral-200 px-6 py-2 font-semibold text-neutral-950 transition-colors hover:bg-neutral-300 sm:order-1 sm:w-auto"
          >
            {t("modernCourseView.common.cancel")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={
              isSaving ||
              groupDeadlines.length === 0 ||
              (deadlineEnabledDraft && groupDeadlines.some((group) => !group.deadline))
            }
            className="order-1 w-full rounded-lg bg-primary-700 px-6 py-2 font-semibold text-white transition-colors hover:bg-primary-800 sm:order-2 sm:w-auto"
          >
            {t("modernCourseView.common.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}
