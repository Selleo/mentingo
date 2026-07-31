import { useNavigate, useParams } from "@remix-run/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateArticles } from "~/api/mutations/admin/useCreateArticles";
import { useArticlesToc } from "~/api/queries/useArticlesToc";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "~/components/ui/sheet";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ArticlesTOCPanel } from "./ArticlesTOCPanel";

export default function ArticlesTOC({ isMobile }: { isMobile: boolean }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { articleId } = useParams();
  const { language } = useLanguageStore();
  const { data: sections } = useArticlesToc(language);
  const {
    createArticle: { mutateAsync: createArticle },
    createArticleSection: { mutateAsync: createArticleSection },
  } = useCreateArticles();

  useEffect(() => {
    if (!isMobile) setIsMobileOpen(false);
  }, [isMobile]);

  const createArticleInSection = async (sectionId: string) => {
    if (!language) return;
    if (isMobile) setIsMobileOpen(false);

    const created = await createArticle({ language, sectionId });
    navigate(`/articles/${created.id}`);
  };

  const handleCreateSection = async () => {
    if (!language) return;
    await createArticleSection({ language });
  };

  const handleNavigate = (id: string) => {
    navigate(`/articles/${id}`);
  };

  if (!isMobile) {
    return (
      <div className="size-full border-r border-r-border bg-white">
        <ArticlesTOCPanel
          sections={sections ?? []}
          activeArticleId={articleId}
          onCreateSection={handleCreateSection}
          onOpenCreateArticle={createArticleInSection}
          onNavigate={handleNavigate}
        />
      </div>
    );
  }

  return (
    <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
      {!isMobileOpen && (
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="primary"
            size="icon"
            aria-label={t("adminArticleView.toc.title")}
            className="fixed bottom-4 left-4 z-30 size-12 rounded-full shadow-lg"
          >
            <Icon name="Article" className="size-5 text-contrast" />
          </Button>
        </SheetTrigger>
      )}
      <SheetContent side="left" className="w-[22rem] max-w-[85vw] p-0">
        <div className="h-dvh overflow-hidden">
          <ArticlesTOCPanel
            sections={sections ?? []}
            activeArticleId={articleId}
            onRequestClose={() => setIsMobileOpen(false)}
            onCreateSection={handleCreateSection}
            onOpenCreateArticle={createArticleInSection}
            onNavigate={handleNavigate}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
