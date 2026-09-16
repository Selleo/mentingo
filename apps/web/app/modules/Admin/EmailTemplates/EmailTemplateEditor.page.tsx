import { useParams } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { useEmailTemplate } from "~/api/queries/useEmailTemplate";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";

import { EmailTemplateEditor } from "./components/EmailTemplateEditor";
import { EMAIL_TEMPLATE_EVENT_OPTIONS, EMAIL_TEMPLATE_LIST_PATH } from "./emailTemplates.constants";

export default function EmailTemplateEditorPage() {
  const { t } = useTranslation();
  const { id, event } = useParams();

  const defaultEvent = EMAIL_TEMPLATE_EVENT_OPTIONS.find((value) => value === event);

  const { data, isPending, isError, refetch } = useEmailTemplate(id, defaultEvent);

  if (!id && !defaultEvent)
    return (
      <PageWrapper>
        <p role="alert">{t("emailTemplates.errors.unsupportedEvent")}</p>
      </PageWrapper>
    );

  if (isError)
    return (
      <PageWrapper>
        <p role="alert">{t("emailTemplates.ui.requestFailed")}</p>
        <Button onClick={() => void refetch()}>{t("emailTemplates.ui.retry")}</Button>
      </PageWrapper>
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
