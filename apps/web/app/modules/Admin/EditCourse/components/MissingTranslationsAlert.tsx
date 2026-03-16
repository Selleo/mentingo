import { useTranslation } from "react-i18next";

export const MissingTranslationsAlert = () => {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <p className="text-sm font-medium text-yellow-900">
        {t("adminCourseView.settings.other.fallbackLanguageWarningTitle")}
      </p>
      <p className="mt-1 text-sm text-yellow-800">
        {t("adminCourseView.settings.other.fallbackLanguageWarningDescription")}
      </p>
    </div>
  );
};
