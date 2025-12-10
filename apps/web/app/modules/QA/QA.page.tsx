import { Link } from "@remix-run/react";
import { ACCESS_GUARD } from "@repo/shared";
import { useTranslation } from "react-i18next";

import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.qa");

export default function QAPage() {
  const { t } = useTranslation();

  return (
    <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_QA_ACCESS}>
      <PageWrapper
        role="main"
        className="!w-full !max-w-none"
        breadcrumbs={[
          { title: t("announcements.breadcrumbs.dashboard"), href: "/" },
          { title: t("navigationSideBar.qa"), href: "/qa" },
        ]}
      >
        <div className="flex flex-col gap-16">
          <div className="flex h-auto w-full flex-col gap-6">
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-2">
                <h4 className="h4 font-semibold">{t("QA.header")}</h4>
                <h5 className="text-xl">{t("QA.subHeader")}</h5>
              </div>
              <Link to="/qa/new">
                <Button>{t("qaView.button.createNew")}</Button>
              </Link>
            </div>
            <div className="rounded-2xl bg-white p-6 drop-shadow"></div>
          </div>
        </div>
      </PageWrapper>
    </ContentAccessGuard>
  );
}
