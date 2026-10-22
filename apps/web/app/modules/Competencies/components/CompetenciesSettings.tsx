import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useExecuteCompetenciesCommand } from "~/api/mutations/useExecuteCompetenciesCommand";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

import type { CompetenciesWorkspace } from "../competencies.types";

export function CompetenciesSettings({ workspace }: { workspace: CompetenciesWorkspace }) {
  const { t } = useTranslation();
  const { mutateAsync: execute, isPending } = useExecuteCompetenciesCommand();
  const [warningDays, setWarningDays] = useState(
    workspace.warningDays === null ? "" : String(workspace.warningDays),
  );
  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
      <h2 className="text-base font-semibold text-neutral-950">
        {t("competencies.expirySettings")}
      </h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await execute({
              operation: "settings",
              warningDays: warningDays === "" ? null : Number(warningDays),
            });
          } catch {
            /* Preserve entered settings. */
          }
        }}
      >
        <Label htmlFor="competency-warning" className="sr-only">
          {t("competencies.warningDays")}
        </Label>
        <div className="flex items-center gap-3">
          <Input
            className="min-w-0 flex-1"
            id="competency-warning"
            type="number"
            min={0}
            step={1}
            value={warningDays}
            onChange={(event) => setWarningDays(event.target.value)}
          />
          <span className="text-sm text-neutral-800" aria-hidden="true">
            {t("competencies.expiryDaysUnit")}
          </span>
          <Button type="submit" variant="outline" className="h-[42px]" disabled={isPending}>
            {t("competencies.save")}
          </Button>
        </div>
        <p className="text-sm text-neutral-800">{t("competencies.warningHelp")}</p>
      </form>
    </section>
  );
}
