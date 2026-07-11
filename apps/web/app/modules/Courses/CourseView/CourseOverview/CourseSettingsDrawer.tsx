import { Settings, X } from "lucide-react";
import { useTranslation } from "react-i18next";

type CourseSettingsDrawerProps = {
  onClose: () => void;
  title: string;
};

export default function CourseSettingsDrawer({ onClose, title }: CourseSettingsDrawerProps) {
  const { t } = useTranslation();
  const settingsItems = [
    t("modernCourseView.overview.settingsStatus"),
    t("modernCourseView.overview.settingsPricing"),
    t("modernCourseView.overview.settingsAssignments"),
    t("modernCourseView.overview.settingsSequential"),
    t("modernCourseView.overview.settingsVisibility"),
    t("modernCourseView.overview.settingsPermissions"),
  ];

  return (
    <>
      <button
        type="button"
        aria-label={t("modernCourseView.overview.closeSettings")}
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed right-0 top-0 z-50 h-full w-full bg-white shadow-2xl transition-transform sm:max-w-md">
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-neutral-200 p-4 md:p-6">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-primary-700" />
              <h2 className="font-gothic text-2xl font-bold text-neutral-950">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-neutral-100"
            >
              <X className="h-5 w-5 text-neutral-800" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="rounded-xl border border-primary-200 bg-primary-50 p-6 text-center">
              <Settings className="mx-auto mb-3 h-12 w-12 text-primary-700" />
              <h3 className="mb-2 text-lg font-semibold text-neutral-950">
                {t("modernCourseView.overview.settingsComingSoon")}
              </h3>
              <p className="text-sm text-neutral-800">
                {t("modernCourseView.overview.settingsIntro")}
              </p>
              <ul className="mt-4 space-y-2 text-left text-sm text-neutral-800">
                {settingsItems.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="font-bold text-primary-700">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-neutral-200 p-4 md:p-6">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-primary-700 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-800"
            >
              {t("modernCourseView.common.close")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
