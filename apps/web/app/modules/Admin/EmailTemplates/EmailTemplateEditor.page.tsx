import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useEmailTemplate } from "~/api/queries/useEmailTemplate";
import ErrorPage from "~/components/ErrorPage/ErrorPage";
import { PageWrapper } from "~/components/PageWrapper";

import { EmailTemplateEditor } from "./components/EmailTemplateEditor";
import { EMAIL_TEMPLATE_BUILT_IN_KEYS, EMAIL_TEMPLATE_LIST_PATH } from "./emailTemplates.constants";

export default function EmailTemplateEditorPage() {
  const { t } = useTranslation();
  const { id, event } = useParams();

  const defaultEvent = EMAIL_TEMPLATE_BUILT_IN_KEYS.find((value) => value === event);

  const { data, isPending, isError } = useEmailTemplate(id, defaultEvent);

  if (!id && !defaultEvent)
    return (
      <PageWrapper>
        <p role="alert">{t("emailTemplates.errors.unsupportedEvent")}</p>
      </PageWrapper>
    );

  if (isError)
    return (
      <ErrorPage
        title={t("emailTemplates.ui.requestFailed")}
        actionLabel={t("common.refreshPage")}
        onAction={() => window.location.reload()}
        className="min-h-[50vh]"
      />
    );

  if (isPending || !data)
    return (
      <PageWrapper
        breadcrumbs={[{ title: t("emailTemplates.ui.title"), href: EMAIL_TEMPLATE_LIST_PATH }]}
      >
        <p role="status">{t("emailTemplates.ui.loading")}</p>
      </PageWrapper>
    );

  return <EmailTemplateEditor key={data.id ?? data.event} template={data} />;
}
