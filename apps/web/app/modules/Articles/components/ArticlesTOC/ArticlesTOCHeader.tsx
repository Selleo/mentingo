import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useUserRole } from "~/hooks/useUserRole";

type ArticlesTOCHeaderProps = {
  onRequestClose?: () => void;
  onCreateSection?: () => void;
  onCreateArticle?: () => void;
};

export function ArticlesTOCHeader({
  onRequestClose,
  onCreateSection,
  onCreateArticle,
}: ArticlesTOCHeaderProps) {
  const { t } = useTranslation();
  const { isAdminLike } = useUserRole();

  const menuItemClassName =
    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-neutral-900 outline-none focus:bg-accent focus:text-accent-foreground";

  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-6">
      <h3 className="text-xl font-gothic font-semibold leading-6 text-neutral-950">
        {t("adminArticleView.toc.title")}
      </h3>

      <div className="hidden items-center gap-1 2xl:flex">
        {isAdminLike && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("adminArticleView.toc.actions.add")}
                className="size-9 rounded-md hover:bg-primary-50 hover:text-primary-700"
              >
                <Icon name="Plus" className="size-4 text-current" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-neutral-600">
                {t("adminArticleView.toc.actions.newLabel")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={menuItemClassName}
                onSelect={() => {
                  onRequestClose?.();
                  onCreateSection?.();
                }}
              >
                <Icon name="Plus" className="size-4 text-neutral-600" />
                {t("adminArticleView.toc.actions.newSection")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className={menuItemClassName}
                onSelect={() => {
                  onRequestClose?.();
                  onCreateArticle?.();
                }}
              >
                <Icon name="Article" className="size-4 text-neutral-600" />
                {t("adminArticleView.toc.actions.newArticle")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
