import { useTranslation } from "react-i18next";

import { PageWrapper } from "~/components/PageWrapper";

import AllArticlesTOC from "./AllArticlesTOC";

function ArticlesPage() {
  const { t } = useTranslation();

  const articleName = "Article";
  const articleId = "123";

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("navigationSideBar.articles"),
          href: "/articles",
        },
        {
          title: articleName,
          href: `/articles/${articleId}`,
        },
      ]}
      className="flex flex-col bg-white min-h-screen"
      leftSideContent={<AllArticlesTOC />}
    >
      <p></p>
    </PageWrapper>
  );
}

export default ArticlesPage;
