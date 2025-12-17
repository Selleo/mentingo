import { useNavigate } from "@remix-run/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useArticlesToc } from "~/api/queries";
import { PageWrapper } from "~/components/PageWrapper";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

function ArticlesPage() {
  const { t } = useTranslation();

  const { language } = useLanguageStore();

  const { data: sections } = useArticlesToc(language);
  const navigate = useNavigate();

  useEffect(() => {
    if (sections && sections.length > 0 && sections[0].articles.length > 0) {
      navigate(`/articles/${sections[0]?.articles[0].id}`);
    }
  }, [sections, navigate]);

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("navigationSideBar.articles"),
          href: "/articles",
        },
      ]}
      className="flex flex-col"
    >
      <p></p>
    </PageWrapper>
  );
}

export default ArticlesPage;
