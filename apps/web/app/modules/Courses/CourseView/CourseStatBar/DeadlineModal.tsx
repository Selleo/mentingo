import { Calendar, Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";

export type GroupDeadline = {
  deadline: string;
  id: string;
  isMandatory: boolean;
  name: string;
};

type DeadlineModalProps = {
  deadlineEnabledDraft: boolean;
  groupDeadlines: GroupDeadline[];
  isSaving: boolean;
  onChangeGroupDeadlines: (groups: GroupDeadline[]) => void;
  onClose: () => void;
  onSave: () => void;
  onToggleDeadline: (enabled: boolean) => void;
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
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl border-0 bg-white p-4 shadow-2xl md:p-6"
        noCloseButton
        aria-describedby={undefined}
      >
        <div className="mb-4 flex items-center justify-between md:mb-6">
          <DialogTitle className="font-gothic text-xl font-bold text-neutral-950 md:text-2xl">
            {t("modernCourseView.deadline.title")}
          </DialogTitle>
          <button
            type="button"
            aria-label={t("modernCourseView.deadline.close")}
            onClick={onClose}
            disabled={isSaving}
          >
            <X className="size-5 text-neutral-800 md:size-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl p-4">
            <div>
              <p className="font-semibold text-neutral-950">
                {t("modernCourseView.deadline.enable")}
              </p>
              <p className="text-sm text-neutral-800">
                {t("modernCourseView.deadline.enableDescription")}
              </p>
            </div>
            <Switch
              checked={deadlineEnabledDraft}
              onCheckedChange={onToggleDeadline}
              disabled={isSaving || groupDeadlines.length === 0}
              aria-label={t("modernCourseView.deadline.enable")}
            />
          </div>

          {groupDeadlines.length === 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {t("adminCourseView.deadlineNoAssignedGroups")}
            </p>
          )}

          {deadlineEnabledDraft && groupDeadlines && <Separator />}

          {deadlineEnabledDraft &&
            groupDeadlines.map((group) => (
              <div
                key={group.id}
                className="flex flex-col items-start justify-between gap-3 rounded-xl p-4 sm:flex-row sm:items-center"
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
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
            className="order-2 w-full sm:order-1 sm:w-auto"
          >
            {t("modernCourseView.common.cancel")}
          </Button>
          <Button
            onClick={onSave}
            disabled={
              isSaving ||
              groupDeadlines.length === 0 ||
              (deadlineEnabledDraft && groupDeadlines.some((group) => !group.deadline))
            }
            className="order-1 flex  items-center justify-center gap-2 sm:order-2"
          >
            <Check className="size-4" />
            {t("modernCourseView.common.saveChanges")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
