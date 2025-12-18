import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { useUserRole } from "~/hooks/useUserRole";
import { cn } from "~/lib/utils";

type Article = { id: string; title: string };
type Section = { id: string; title: string; articles: Article[] };

type ArticlesTOCSectionProps = {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  activeArticleId?: string;
  onNavigate: (articleId: string) => void;
};

export function ArticlesTOCSection({
  section,
  isOpen,
  onToggle,
  onEdit,
  activeArticleId,
  onNavigate,
}: ArticlesTOCSectionProps) {
  const { isAdminLike } = useUserRole();

  return (
    <div className="py-0.5">
      <div className="group flex w-full items-center gap-1 overflow-hidden rounded-md px-1 py-0.5 text-neutral-700 transition-colors hover:bg-primary-50 hover:text-primary-700">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-auto flex-1 justify-between overflow-hidden px-2 py-1.5 hover:bg-transparent"
        >
          <div className="flex items-center gap-2 overflow-hidden">
            <Icon
              name="ChevronRight"
              className={cn(
                "size-3.5 shrink-0 text-neutral-500 transition-transform duration-200",
                isOpen && "rotate-90 text-primary-700",
              )}
            />
            <span className="truncate text-left text-xs font-medium text-current">
              {section.title}
            </span>
          </div>

          <span
            className={cn(
              "text-xs leading-4 text-neutral-400 transition-colors group-hover:text-primary-700",
              isOpen && "text-primary-700",
            )}
          >
            {section.articles.length}
          </span>
        </Button>

        {isAdminLike && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-neutral-500 hover:bg-white/50 hover:text-primary-700"
            aria-label="Edit section"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
          >
            <Icon name="Edit" className="size-4" />
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="flex flex-col gap-1 pl-6 pt-0.5">
          {section.articles.map((article) => {
            const isActive = article.id === activeArticleId;
            return (
              <div key={article.id}>
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "group h-auto w-full justify-start items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-primary-50 hover:text-primary-700",
                    isActive ? "bg-primary-50 text-primary-700" : "text-neutral-700",
                  )}
                  onClick={() => onNavigate(article.id)}
                >
                  <Icon
                    name="Article"
                    className={cn(
                      "size-4 shrink-0 mt-0.5 transition-colors group-hover:text-primary-700",
                      isActive ? "text-primary-700" : "text-neutral-500",
                    )}
                  />
                  <span
                    className={cn("whitespace-normal break-words text-sm", {
                      "font-medium": isActive,
                    })}
                  >
                    {article.title}
                  </span>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
