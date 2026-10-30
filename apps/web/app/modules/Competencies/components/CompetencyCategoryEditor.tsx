import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import type { CompetencyCategory } from "../competencies.types";

export function CompetencyCategoryEditor({
  category,
  onClose,
  onSaved,
}: {
  category?: CompetencyCategory;
  onClose: () => void;
  onSaved?: (category: Pick<CompetencyCategory, "id" | "name">) => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const [name, setName] = useState(category?.name ?? "");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[90vh] max-w-md flex-col gap-0 overflow-hidden p-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-6 py-5 text-left">
          <DialogTitle>
            {t(category ? "competencies.categories.edit" : "competencies.categories.new")}
          </DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              const result = await execute({
                operation: "save_category",
                id: category?.id,
                revision: category?.revision,
                name: name.trim(),
              });
              onSaved?.({ id: result.id, name: name.trim() });
              onClose();
            } catch {
              /* The mutation reports the error and keeps the name for correction. */
            }
          }}
        >
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-6 py-5">
            <Label htmlFor="competency-category-name">{t("competencies.name")}</Label>
            <Input
              id="competency-category-name"
              required
              maxLength={200}
              value={name}
              disabled={isPending}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-neutral-200 px-6 py-4 sm:gap-0">
            <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
              {t("competencies.cancel")}
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {t("competencies.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
