import { useTranslation } from "react-i18next";

export const MissingTranslationsAlert = () => {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <p className="text-sm text-yellow-800">
        {t("adminCourseView.settings.other.fallbackLanguageWarning")}
      </p>
    </div>
  );
};
