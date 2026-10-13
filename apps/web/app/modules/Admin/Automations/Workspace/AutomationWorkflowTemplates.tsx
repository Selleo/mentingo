import { useNavigate } from "@remix-run/react";
import { AUTOMATION_STEP_TYPES } from "@repo/shared";
import { CopyPlus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateAutomationFromTemplate } from "~/api/mutations/automations/useCreateAutomationFromTemplate";
import { useAutomationWorkflowTemplates } from "~/api/queries/useAutomationWorkflowTemplates";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { SearchInput } from "~/components/SearchInput/SearchInput";
import { Button } from "~/components/ui/button";

import { AutomationNodeIcon } from "../Builder/components/automationIcons";

import type { AutomationWorkflowTemplate } from "@repo/shared";

export function AutomationWorkflowTemplates() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: templates = [], isPending, isError } = useAutomationWorkflowTemplates();
  const { mutateAsync: createAutomation, isPending: isCreating } =
    useCreateAutomationFromTemplate();
  const matchingTemplates = templates.filter((template) =>
    template.definition.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );

  async function createAutomationFromTemplate(template: AutomationWorkflowTemplate) {
    const created = await createAutomation(template.key);

    navigate(`/admin/automations/${created.id}`);
  }

  if (isError)
    return (
      <ErrorPage
        title={t("automations.requestFailed")}
        actionLabel={t("common.refreshPage")}
        onAction={() => window.location.reload()}
        className="min-h-[50vh]"
      />
    );

  return (
    <div className="space-y-4">
      <div>
        <h4 className="h4">{t("automationWorkspace.templates")}</h4>
        <p className="mt-2 text-sm text-neutral-600">
          {t("automationWorkspace.templatesDescription")}
        </p>
      </div>
      <SearchInput
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label={t("automationWorkspace.searchTemplates")}
        placeholder={t("automationWorkspace.searchTemplates")}
        wrapperClassName="sm:max-w-xs"
      />
      {isPending && (
        <p role="status" className="py-12 text-center text-neutral-500">
          {t("automations.loading")}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {matchingTemplates.map((template) => {
          const trigger = template.definition.workflow.steps.find(
            (step) => step.type === AUTOMATION_STEP_TYPES.TRIGGER,
          );

          return (
            <article
              key={template.key}
              className="flex flex-col gap-4 rounded-lg border bg-white p-5"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                  <AutomationNodeIcon
                    eventKind={
                      trigger?.type === AUTOMATION_STEP_TYPES.TRIGGER
                        ? trigger.config.eventKind
                        : undefined
                    }
                  />
                </span>
                <div className="min-w-0 space-y-2">
                  <h5 className="text-sm font-semibold">{template.definition.name}</h5>
                  {template.definition.description && (
                    <p className="text-sm leading-relaxed text-neutral-600">
                      {template.definition.description}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-auto w-fit gap-2 self-end"
                disabled={isCreating}
                onClick={() => void createAutomationFromTemplate(template).catch(() => undefined)}
              >
                <CopyPlus className="size-4" aria-hidden="true" />
                {t("automationWorkspace.useTemplate")}
              </Button>
            </article>
          );
        })}
      </div>
      {!isPending && !isError && !matchingTemplates.length && (
        <p className="py-12 text-center text-neutral-500">
          {t("automationBuilder.creation.noResults")}
        </p>
      )}
    </div>
  );
}
