import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useAutomation } from "~/api/queries/useAutomation";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { AutomationEditor } from "./AutomationEditor";

function ExistingAutomation({ id }: { id: string }) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data, isPending, isError } = useAutomation(id);

  if (isPending) return <p role="status">{t("automations.loading")}</p>;

  if (isError || !data)
    return (
      <ErrorPage
        title={t("automations.requestFailed")}
        actionLabel={t("common.refreshPage")}
        onAction={() => window.location.reload()}
        className="min-h-[50vh]"
      />
    );

  return <AutomationEditor key={`${id}:${language}`} automation={data} />;
}

export default function AutomationEditorPage() {
  const { id } = useParams();

  return <>{id ? <ExistingAutomation id={id} /> : <AutomationEditor />}</>;
}
