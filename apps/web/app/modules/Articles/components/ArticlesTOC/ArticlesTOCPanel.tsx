import { PERMISSIONS } from "@repo/shared";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteArticleSection } from "~/api/mutations/admin/useDeleteArticleSection";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";

import {
  ARTICLES_TOC_HANDLES,
  ARTICLE_SECTION_FORM_HANDLES,
} from "../../../../../e2e/data/articles/handles";

import { ArticlesTOCHeader } from "./ArticlesTOCHeader";
import { ArticlesTOCSection } from "./ArticlesTOCSection";
import { EditArticleSectionSheet } from "./EditArticleSectionSheet";

import type { GetArticleTocResponse } from "~/api/generated-api";

type ArticlesTOCPanelProps = {
  sections: GetArticleTocResponse["data"]["sections"];
  activeArticleId?: string;
  onRequestClose?: () => void;
  onCreateSection: () => Promise<void>;
  onOpenCreateArticle: (sectionId: string) => void;
  onNavigate: (articleId: string) => void;
};

export function ArticlesTOCPanel({
  sections,
  activeArticleId,
  onRequestClose,
  onCreateSection,
  onOpenCreateArticle,
  onNavigate,
}: ArticlesTOCPanelProps) {
  const { t } = useTranslation();
  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSectionId, setEditSectionId] = useState<string | undefined>(undefined);
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<{
    id: string;
    articlesCount: number;
  }>();
  const { mutateAsync: deleteSection, isPending: isDeleting } = useDeleteArticleSection();
  const { hasAccess: canManageArticles } = usePermissions({
    required: [PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN],
  });

  useEffect(() => {
    if (!sectionIds.length) return;

    setExpanded((prev) => {
      if (prev.length === 0) return sectionIds;

      const filtered = prev.filter((id) => sectionIds.includes(id));
      const newOnes = sectionIds.filter((id) => !filtered.includes(id));

      return [...filtered, ...newOnes];
    });
  }, [sectionIds]);

  return (
    <div
      className="relative border-l flex size-full min-h-0 flex-col bg-white pt-4"
      data-testid={ARTICLES_TOC_HANDLES.PANEL}
    >
      <ArticlesTOCHeader />

      <Separator className="mb-3" />

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
        {sections.map((section) => (
          <ArticlesTOCSection
            key={section.id}
            section={section}
            isOpen={expanded.includes(section.id)}
            onToggle={() =>
              setExpanded((prev) => {
                if (prev.includes(section.id)) return prev.filter((id) => id !== section.id);
                return [...prev, section.id];
              })
            }
            onEdit={() => {
              setEditSectionId(section.id);
              setIsEditOpen(true);
            }}
            onDelete={() =>
              setDeleteSectionTarget({
                id: section.id,
                articlesCount: section.articles.length,
              })
            }
            onCreateArticle={() => {
              onRequestClose?.();
              onOpenCreateArticle(section.id);
            }}
            activeArticleId={activeArticleId}
            onNavigate={(id) => {
              onRequestClose?.();
              onNavigate(id);
            }}
          />
        ))}

        {canManageArticles && (
          <div className={cn("px-1 pt-2", sections.length > 0 && "mt-2")}>
            <Button
              data-testid={ARTICLES_TOC_HANDLES.CREATE_SECTION_ACTION}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-start gap-2 rounded-md px-2 py-2 text-neutral-600 hover:bg-primary-50 hover:text-primary-700"
              onClick={() => {
                onRequestClose?.();
                void onCreateSection();
              }}
            >
              <Icon name="Plus" className="size-4" />
              {t("adminArticleView.toc.actions.newSection")}
            </Button>
          </div>
        )}
      </div>

      <EditArticleSectionSheet
        open={isEditOpen}
        sectionId={editSectionId}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditSectionId(undefined);
        }}
      />

      <Dialog
        open={Boolean(deleteSectionTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteSectionTarget(undefined);
        }}
      >
        <DialogContent
          className="max-w-md"
          noCloseButton={isDeleting}
          data-testid={ARTICLE_SECTION_FORM_HANDLES.DELETE_DIALOG}
        >
          <DialogTitle>{t("adminArticleView.section.delete.title")}</DialogTitle>
          <DialogDescription>
            {deleteSectionTarget?.articlesCount
              ? t("adminArticleView.section.cannotDeleteWithArticles")
              : t("adminArticleView.section.delete.description")}
          </DialogDescription>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" disabled={isDeleting}>
                {t("common.button.cancel")}
              </Button>
            </DialogClose>
            <Button
              data-testid={ARTICLE_SECTION_FORM_HANDLES.DELETE_CONFIRM_BUTTON}
              type="button"
              variant="destructive"
              disabled={isDeleting || !deleteSectionTarget || deleteSectionTarget.articlesCount > 0}
              onClick={async () => {
                if (!deleteSectionTarget) return;
                await deleteSection({ sectionId: deleteSectionTarget.id });
                setDeleteSectionTarget(undefined);
              }}
            >
              {t("common.button.delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
