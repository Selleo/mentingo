import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";

export function LearningPathsEmptyState() {
  const { t } = useTranslation();

  return (
    <div className="rounded-[2rem] border border-dashed border-neutral-300 bg-neutral-50 p-8">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <Icon name="EmptyCourse" className="text-neutral-900" />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-lg font-semibold leading-6 text-neutral-950">
            {t("learningPathsView.empty.title")}
          </p>
          <p className="text-base leading-6 text-neutral-700">
            {t("learningPathsView.empty.description")}
          </p>
        </div>
      </div>
    </div>
  );
}
