import { useEffect, useMemo, useState } from "react";

import { Separator } from "~/components/ui/separator";
import { useUserRole } from "~/hooks/useUserRole";

import { ArticlesTOCAddFab } from "./ArticlesTOCAddFab";
import { ArticlesTOCHeader } from "./ArticlesTOCHeader";
import { ArticlesTOCSection } from "./ArticlesTOCSection";
import { EditArticleSectionSheet } from "./EditArticleSectionSheet";

import type { GetArticleTocResponse } from "~/api/generated-api";

type ArticlesTOCPanelProps = {
  sections: GetArticleTocResponse["data"]["sections"];
  activeArticleId?: string;
  onRequestClose?: () => void;
  onCreateSection: () => Promise<void>;
  onOpenCreateArticle: () => void;
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
  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editSectionId, setEditSectionId] = useState<string | undefined>(undefined);
  const { isAdminLike } = useUserRole();

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
    <div className="relative border-l flex size-full min-h-0 flex-col bg-white pt-4">
      <ArticlesTOCHeader
        onRequestClose={onRequestClose}
        onCreateSection={onCreateSection}
        onCreateArticle={onOpenCreateArticle}
      />

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
            activeArticleId={activeArticleId}
            onNavigate={(id) => {
              onRequestClose?.();
              onNavigate(id);
            }}
          />
        ))}
      </div>

      {onRequestClose && isAdminLike && (
        <div className="2xl:hidden">
          <ArticlesTOCAddFab
            onRequestClose={onRequestClose}
            onCreateSection={onCreateSection}
            onCreateArticle={onOpenCreateArticle}
          />
        </div>
      )}

      <EditArticleSectionSheet
        open={isEditOpen}
        sectionId={editSectionId}
        onOpenChange={(open) => {
          setIsEditOpen(open);
          if (!open) setEditSectionId(undefined);
        }}
      />
    </div>
  );
}
