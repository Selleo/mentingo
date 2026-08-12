import { useTranslation } from "react-i18next";

export function ArticlesTOCHeader() {
  const { t } = useTranslation();

  return (
    <div className="px-4 pb-6">
      <h3 className="text-xl font-gothic font-semibold leading-6 text-neutral-950">
        {t("adminArticleView.toc.title")}
      </h3>
    </div>
  );
}
