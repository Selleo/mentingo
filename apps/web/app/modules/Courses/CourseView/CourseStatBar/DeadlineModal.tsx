import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

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
          <h3 className="font-gothic text-xl font-bold text-[#363636] md:text-2xl">
            {t("modernCourseView.deadline.title")}
          </h3>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5 text-[#676767] md:h-6 md:w-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-[#e5e5e5] bg-[#f9fafb] p-4">
            <div>
              <p className="font-semibold text-[#363636]">
                {t("modernCourseView.deadline.enable")}
              </p>
              <p className="text-sm text-[#676767]">
                {t("modernCourseView.deadline.enableDescription")}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={deadlineEnabledDraft}
              disabled={groupDeadlines.length === 0}
              onClick={onToggleDeadline}
              className={`relative h-8 w-14 rounded-full transition-colors ${
                groupDeadlines.length === 0 ? "cursor-not-allowed" : ""
              } ${deadlineEnabledDraft ? "bg-[#D4705D]" : "bg-gray-300"}`}
            >
              <div
                className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white transition-transform ${
                  deadlineEnabledDraft ? "translate-x-6" : ""
                }`}
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
                className="flex flex-col items-start justify-between gap-3 rounded-xl border border-[#e5e5e5] bg-[#f9fafb] p-4 sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <p className="font-semibold text-[#363636]">{group.name}</p>
                  <p className="text-sm text-[#676767]">
                    {t("modernCourseView.deadline.current", { deadline: group.deadline })}
                  </p>
                </div>
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
                  className="w-full rounded-lg border border-[#e5e5e5] px-3 py-2 text-sm sm:w-auto"
                />
              </div>
            ))}
        </div>
        <div className="mt-6 flex flex-col justify-end gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="order-2 w-full rounded-lg bg-gray-200 px-6 py-2 font-semibold text-[#363636] transition-colors hover:bg-gray-300 sm:order-1 sm:w-auto"
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
            className="order-1 w-full rounded-lg bg-[#3f58b6] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#324a95] sm:order-2 sm:w-auto"
          >
            {t("modernCourseView.common.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}
