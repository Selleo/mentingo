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
          <div className="flex items-center justify-between border-b border-[#e5e5e5] p-4 md:p-6">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-[#3f58b6]" />
              <h2 className="font-gothic text-2xl font-bold text-[#363636]">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-[#676767]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
              <Settings className="mx-auto mb-3 h-12 w-12 text-[#3f58b6]" />
              <h3 className="mb-2 text-lg font-semibold text-[#363636]">Settings Coming Soon</h3>
              <p className="text-sm text-[#676767]">
                {t("modernCourseView.overview.settingsIntro")}
              </p>
              <ul className="mt-4 space-y-2 text-left text-sm text-[#676767]">
                {settingsItems.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="font-bold text-[#3f58b6]">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-[#e5e5e5] p-4 md:p-6">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-[#3f58b6] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#324a95]"
            >
              {t("modernCourseView.common.close")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
