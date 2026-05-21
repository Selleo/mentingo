import { useTranslation } from "react-i18next";

import { LEARNING_PATHS_PAGE_HANDLES } from "../../../../e2e/data/learning-paths/handles";

import { LearningPathsSearchInput } from "./LearningPathsSearchInput";

export function LearningPathsPageHeader() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 lg:p-0">
      <div className="flex flex-col lg:p-0">
        <h4 className="h4 pb-1 text-neutral-950" data-testid={LEARNING_PATHS_PAGE_HANDLES.HEADING}>
          {t("learningPathsView.title")}
        </h4>
        <p className="body-lg-md text-neutral-800">{t("learningPathsView.description")}</p>
      </div>
      <LearningPathsSearchInput />
    </div>
  );
}
