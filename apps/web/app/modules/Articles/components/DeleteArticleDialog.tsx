import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

import { ARTICLE_DETAILS_PAGE_HANDLES } from "../../../../e2e/data/articles/handles";

type DeleteArticleDialogProps = {
  articleId?: string;
  isDeleting?: boolean;
  onDelete: (articleId: string) => void;
};

export function DeleteArticleDialog({
  articleId,
  isDeleting = false,
  onDelete,
}: DeleteArticleDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          data-testid={ARTICLE_DETAILS_PAGE_HANDLES.DELETE_BUTTON}
          variant="outline"
          className="gap-2"
          disabled={isDeleting}
        >
          <Icon name="TrashIcon" className="size-4" />
          <span className="text-sm font-semibold leading-5 text-neutral-800">
            {t("common.button.delete")}
          </span>
        </Button>
      </DialogTrigger>

      <DialogContent
        className="max-w-md"
        noCloseButton={isDeleting}
        data-testid={ARTICLE_DETAILS_PAGE_HANDLES.DELETE_DIALOG}
      >
        <DialogTitle>{t("articlesView.deleteModal.title")}</DialogTitle>
        <DialogDescription>{t("articlesView.deleteModal.description")}</DialogDescription>

        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost" className="text-primary-800" disabled={isDeleting}>
              {t("common.button.cancel")}
            </Button>
          </DialogClose>
          <Button
            data-testid={ARTICLE_DETAILS_PAGE_HANDLES.DELETE_CONFIRM_BUTTON}
            onClick={() => {
              if (!articleId) return;
              onDelete(articleId);
            }}
            className="bg-error-500 text-white hover:bg-error-600"
            disabled={isDeleting || !articleId}
          >
            {t("common.button.delete")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
