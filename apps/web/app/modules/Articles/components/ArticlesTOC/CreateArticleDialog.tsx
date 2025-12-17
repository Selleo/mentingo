import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type SectionOption = { id: string; title: string };

type CreateArticleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: SectionOption[];
  isCreating?: boolean;
  onCreate: (sectionId: string) => void;
};

export function CreateArticleDialog({
  open,
  onOpenChange,
  sections,
  isCreating,
  onCreate,
}: CreateArticleDialogProps) {
  const { t } = useTranslation();
  const options = useMemo(() => sections ?? [], [sections]);

  const [sectionId, setSectionId] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (sectionId) return;
    if (!options.length) return;
    setSectionId(options[0]!.id);
  }, [open, options, sectionId]);

  const canCreate = !!sectionId && options.length > 0 && !isCreating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("adminArticleView.dialog.createArticle.title")}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="article-section-select">
            {t("adminArticleView.dialog.createArticle.sectionLabel")}
          </Label>
          <Select value={sectionId} onValueChange={setSectionId} disabled={!options.length}>
            <SelectTrigger id="article-section-select">
              <SelectValue
                placeholder={t("adminArticleView.dialog.createArticle.sectionPlaceholder")}
              />
            </SelectTrigger>
            <SelectContent>
              {options.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.button.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => onCreate(sectionId)}
            disabled={!canCreate}
            aria-disabled={!canCreate}
          >
            {t("adminArticleView.dialog.createArticle.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
