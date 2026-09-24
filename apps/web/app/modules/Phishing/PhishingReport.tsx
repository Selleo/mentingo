import { Link, useParams } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCancelPhishingCampaign } from "~/api/mutations/useCancelPhishingCampaign";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { usePhishingReport } from "~/api/queries/usePhishingReport";
import { hasPermission } from "~/common/permissions/permission.utils";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";

import { PhishingGate } from "./PhishingGate";
function Report({ hall = false }: { hall?: boolean }) {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();
  const { data, isPending, isError, refetch } = usePhishingReport(id);
  const { mutateAsync: cancel, isPending: cancelling } = useCancelPhishingCampaign();
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (isPending)
    return (
      <PageWrapper>
        <p role="status">{t("phishing.loading")}</p>
      </PageWrapper>
    );
  if (isError || !data)
    return (
      <PageWrapper>
        <p role="alert">{t("phishing.serviceError")}</p>
        <Button onClick={() => void refetch()}>{t("phishing.retry")}</Button>
      </PageWrapper>
    );
  const recipients = hall
    ? data.recipients.filter((r) => r.clickedAt || r.submittedAt)
    : data.recipients;
  const groups = hall
    ? [...data.groups].sort((a, b) => b.totals.riskRate - a.totals.riskRate)
    : data.groups;
  async function cancelCampaign() {
    try {
      await cancel(id);
      setConfirmCancel(false);
    } catch {
      /* Mutation hook displays the translated error. */
    }
  }
  return (
    <PageWrapper>
      <Link to="/phishing">{t("phishing.back")}</Link>
      <h1 className="my-5 text-2xl font-semibold">
        {data.campaign.name}
        {hall && ` — ${t("phishing.hall")}`}
      </h1>
      <div className="mb-5 flex flex-wrap gap-4">
        <Link className="underline" to={hall ? `/phishing/${id}` : `/phishing/${id}/hall-of-shame`}>
          {hall ? t("phishing.report") : t("phishing.hall")}
        </Link>
        <Button variant="outline" onClick={() => void refetch()}>
          {t("phishing.refresh")}
        </Button>
        {hasPermission(user?.permissions ?? [], PERMISSIONS.PHISHING_MANAGE) &&
          data.campaign.status === "scheduled" && (
            <Button variant="outline" onClick={() => setConfirmCancel(true)}>
              {t("phishing.cancel")}
            </Button>
          )}
      </div>
      {confirmCancel && (
        <div role="alert" className="mb-6 rounded border p-4">
          <p>{t("phishing.cancelConfirm")}</p>
          <Button disabled={cancelling} onClick={() => void cancelCampaign()}>
            {t("phishing.cancel")}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
            {t("phishing.back")}
          </Button>
        </div>
      )}
      <p className="mb-5 text-neutral-600">{t("phishing.educationalOnly")}</p>
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {(["recipients", "sent", "clicked", "submitted", "riskRate"] as const).map((key) => (
          <div key={key} className="rounded-lg border p-4">
            <p>{t(`phishing.metrics.${key}`)}</p>
            <strong className="text-2xl">
              {data.totals[key]}
              {key === "riskRate" && "%"}
            </strong>
          </div>
        ))}
      </div>
      <h2 className="mb-3 text-xl font-semibold">{t("phishing.groups")}</h2>
      <div className="mb-8 grid gap-3">
        {groups.map((g) => (
          <p key={g.id}>
            {g.name}: {g.totals.risky}/{g.totals.recipients} ({g.totals.riskRate}%)
          </p>
        ))}
      </div>
      <h2 className="mb-3 text-xl font-semibold">{t("phishing.people")}</h2>
      {!recipients.length && <p>{t("phishing.noResults")}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              {["person", "sent", "clicked", "submitted", "courseStatus"].map((key) => (
                <th key={key} className="border-b p-3">
                  {t(`phishing.columns.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.userId}>
                <td className="border-b p-3">
                  {r.firstName} {r.lastName}
                  <br />
                  <span className="text-sm text-neutral-600">{r.email}</span>
                </td>
                <td className="border-b p-3">
                  {r.sentAt ? new Date(r.sentAt).toLocaleString() : t("phishing.pending")}
                </td>
                <td className="border-b p-3">
                  {r.clickedAt ? new Date(r.clickedAt).toLocaleString() : "—"}
                </td>
                <td className="border-b p-3">
                  {r.submittedAt ? new Date(r.submittedAt).toLocaleString() : "—"}
                </td>
                <td className="border-b p-3">
                  {t(`phishing.courseStatuses.${r.courseStatus}`, { defaultValue: r.courseStatus })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageWrapper>
  );
}
export function PhishingReport({ hall = false }: { hall?: boolean }) {
  return (
    <PhishingGate>
      <Report hall={hall} />
    </PhishingGate>
  );
}
