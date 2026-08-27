import { Link } from "@remix-run/react";
import { AUDIT_TYPES, PERMISSIONS } from "@repo/shared";
import { ChevronRight, School, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useAuditHistory } from "~/api/queries/useAuditHistory";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { PageWrapper } from "~/components/PageWrapper/PageWrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { usePermissions } from "~/hooks/usePermissions";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";
import type { LucideIcon } from "lucide-react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.audit");

type AuditOptionCardProps = {
  title: string;
  description: string;
  action: string;
  href: string;
  icon: LucideIcon;
};

const AuditOptionCard = ({
  title,
  description,
  action,
  href,
  icon: Icon,
}: AuditOptionCardProps) => (
  <Card className="flex min-h-[300px] flex-col items-start border-primary-100 bg-white p-6 shadow-none md:p-8">
    <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-700">
      <Icon className="size-7" aria-hidden="true" />
    </div>
    <h2 className="mt-8 h4 text-neutral-950">{title}</h2>
    <p className="mt-3 max-w-2xl flex-1 body-lg text-neutral-700">{description}</p>
    <Button asChild className="mt-8">
      <Link to={href}>{action}</Link>
    </Button>
  </Card>
);

export default function AuditPage() {
  const { t, i18n } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  const { hasAccess: canCompleteIndividualAudit } = usePermissions({
    required: PERMISSIONS.STATISTICS_READ_SELF,
  });
  const { hasAccess: hasSchoolAuditPermission } = usePermissions({
    required: PERMISSIONS.STATISTICS_READ,
  });
  const canCompleteSchoolAudit =
    hasSchoolAuditPermission && !(currentUser?.isManagingTenant && !currentUser.isSupportMode);
  const { data: individualHistory } = useAuditHistory(
    AUDIT_TYPES.INDIVIDUAL,
    canCompleteIndividualAudit,
  );
  const { data: schoolHistory } = useAuditHistory(AUDIT_TYPES.SCHOOL, canCompleteSchoolAudit);
  const history = [...(individualHistory ?? []), ...(schoolHistory ?? [])].sort(
    (left, right) => new Date(right.completedAt).getTime() - new Date(left.completedAt).getTime(),
  );
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <PageWrapper>
      <div className="mx-auto w-full max-w-[1440px]">
        <div className="mb-8">
          <h1 className="h3 text-neutral-950">{t("auditView.title")}</h1>
          <p className="mt-2 body-lg text-neutral-700">{t("auditView.subtitle")}</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {canCompleteIndividualAudit && (
            <AuditOptionCard
              title={t("auditView.individual.title")}
              description={t("auditView.individual.description")}
              action={t("auditView.individual.start")}
              href="/audit/individual"
              icon={UserRound}
            />
          )}
          {canCompleteSchoolAudit && (
            <AuditOptionCard
              title={t("auditView.school.title")}
              description={t("auditView.school.description")}
              action={t("auditView.school.start")}
              href="/audit/school"
              icon={School}
            />
          )}
        </div>

        <section className="mt-12">
          <h2 className="h4 text-neutral-950">{t("auditView.history.title")}</h2>
          <p className="mt-2 body-lg text-neutral-600">{t("auditView.history.description")}</p>
          <div className="mt-6 space-y-3">
            {history.map((audit) => {
              const titleKey =
                audit.type === AUDIT_TYPES.INDIVIDUAL
                  ? "auditView.individual.title"
                  : "auditView.school.title";
              return (
                <Link
                  key={audit.id}
                  to={`/audit/results/${audit.type}/${audit.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-primary-100 bg-white p-5 transition-colors hover:border-primary-300 hover:bg-primary-50/30"
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="h6 text-neutral-950">{t(titleKey)}</h3>
                    <p className="mt-1 body-base text-neutral-600">
                      {t("auditView.history.completed", {
                        date: dateFormatter.format(new Date(audit.completedAt)),
                      })}
                    </p>
                  </div>
                  <Badge className="shrink-0 rounded-full px-3 py-1 text-sm">
                    {t("auditView.history.score", { score: audit.score })}
                  </Badge>
                  <ChevronRight
                    className="size-5 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              );
            })}
            {history.length === 0 && (
              <Card className="border-neutral-200 p-6 text-neutral-600 shadow-none">
                {t("auditView.history.empty")}
              </Card>
            )}
          </div>
        </section>
      </div>
    </PageWrapper>
  );
}
