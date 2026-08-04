import { format, isValid, parseISO } from "date-fns";
import { CalendarDays, Check, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { getDateLocale } from "~/utils/getDateLocale";

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

type DeadlineDatePickerProps = {
  deadline: string;
  onChange: (deadline: string) => void;
  placeholder: string;
};

function DeadlineDatePicker({ deadline, onChange, placeholder }: DeadlineDatePickerProps) {
  const [open, setOpen] = useState(false);
  const language = useLanguageStore((state) => state.language);
  const calendarLocale = getDateLocale(language);
  const parsedDate = deadline ? parseISO(deadline) : undefined;
  const selectedDate = parsedDate && isValid(parsedDate) ? parsedDate : undefined;
  const currentYear = new Date().getFullYear();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2 border-neutral-200 bg-white font-normal text-neutral-900 shadow-sm"
        >
          <CalendarDays className="size-4 shrink-0 text-neutral-500" />
          <span className="truncate text-left">
            {selectedDate ? format(selectedDate, "PPP", { locale: calendarLocale }) : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          variant="default"
          mode="single"
          captionLayout="dropdown-buttons"
          selected={selectedDate}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          fromYear={2000}
          toYear={currentYear + 15}
          initialFocus
          weekStartsOn={1}
          locale={calendarLocale}
        />
      </PopoverContent>
    </Popover>
  );
}

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
                <div className="w-full sm:w-48">
                  <DeadlineDatePicker
                    deadline={group.deadline}
                    onChange={(deadline) => {
                      const updated = groupDeadlines.map((currentGroup) =>
                        currentGroup.id === group.id ? { ...currentGroup, deadline } : currentGroup,
                      );
                      onChangeGroupDeadlines(updated);
                    }}
                    placeholder={t("adminCourseView.selectDate")}
                  />
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
