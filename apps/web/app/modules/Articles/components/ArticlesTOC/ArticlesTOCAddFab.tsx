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

type ArticlesTOCAddFabProps = {
  onRequestClose: () => void;
  onCreateSection?: () => void;
  onCreateArticle?: () => void;
};

export function ArticlesTOCAddFab({
  onRequestClose,
  onCreateSection,
  onCreateArticle,
}: ArticlesTOCAddFabProps) {
  const { t } = useTranslation();

  const menuItemClassName =
    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-neutral-900 outline-none focus:bg-accent focus:text-accent-foreground";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="primary"
          size="icon"
          aria-label={t("adminArticleView.toc.actions.add")}
          className="fixed bottom-4 left-4 z-50 size-12 rounded-full shadow-lg"
        >
          <Icon name="Plus" className="size-5 text-contrast" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="text-xs text-neutral-600">
          {t("adminArticleView.toc.actions.newLabel")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className={menuItemClassName}
          onSelect={() => {
            onRequestClose();
            onCreateSection?.();
          }}
        >
          <Icon name="Plus" className="size-4 text-neutral-600" />
          {t("adminArticleView.toc.actions.newSection")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuItemClassName}
          onSelect={() => {
            onRequestClose();
            onCreateArticle?.();
          }}
        >
          <Icon name="Article" className="size-4 text-neutral-600" />
          {t("adminArticleView.toc.actions.newArticle")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
