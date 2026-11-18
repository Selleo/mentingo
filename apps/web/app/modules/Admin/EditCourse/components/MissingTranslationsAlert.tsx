import { useTranslation } from "react-i18next";

import { AI_MENTOR_LESSON_FORM_HANDLES } from "../../../../../e2e/data/curriculum/handles";

export const MissingTranslationsAlert = () => {
  const { t } = useTranslation();

  return (
    <div
      data-testid={AI_MENTOR_LESSON_FORM_HANDLES.MISSING_TRANSLATIONS_ALERT}
      className="rounded-lg border border-yellow-200 bg-yellow-50 p-4"
    >
      <p className="text-sm font-medium text-yellow-900">
        {t("adminCourseView.settings.other.fallbackLanguageWarningTitle")}
      </p>
      <p className="mt-1 text-sm text-yellow-800">
        {t("adminCourseView.settings.other.fallbackLanguageWarningDescription")}
      </p>
    </div>
  );
};
