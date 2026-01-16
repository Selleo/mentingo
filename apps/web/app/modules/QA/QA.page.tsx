import { Link, useSearchParams } from "@remix-run/react";
import { ACCESS_GUARD } from "@repo/shared";
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

import useAllQA from "~/api/queries/useAllQA";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { PageWrapper } from "~/components/PageWrapper";
import { Accordion } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";
import { ContentAccessGuard } from "~/Guards/AccessGuard";
import { useUserRole } from "~/hooks/useUserRole";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import QAItem from "~/modules/QA/components/QAItem";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.qa");

export default function QAPage() {
  const { t } = useTranslation();

  const { isAdmin } = useUserRole();
  const { data: settings } = useUserSettings();

  const { language } = useLanguageStore();

  const { data: QA } = useAllQA(language);
  const [searchParams] = useSearchParams();
  const [openItem, setOpenItem] = useState<string | undefined>(undefined);
  const focusedQaId = searchParams.get("qaId") ?? undefined;

  useEffect(() => {
    if (!focusedQaId) return;
    if (!QA?.some((item) => item.id === focusedQaId)) return;

    setOpenItem(focusedQaId);
  }, [focusedQaId, QA]);

  useEffect(() => {
    if (!openItem) return;

    const target = document.getElementById(`qa-${openItem}`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openItem]);

  const filteredQA = useMemo(() => {
    if (isAdmin) return QA;

    return QA?.filter((item) => {
      if (settings?.language !== "en" && settings?.language !== "pl") return false;

      return item.availableLocales.includes(settings.language);
    });
  }, [QA, isAdmin, settings?.language]);

  return (
    <ContentAccessGuard type={ACCESS_GUARD.UNREGISTERED_QA_ACCESS}>
      <PageWrapper
        role="main"
        className="!w-full !max-w-none"
        breadcrumbs={[{ title: t("navigationSideBar.qa"), href: "/qa" }]}
      >
        <div className="flex w-full max-w-4xl mx-auto flex-col gap-16">
          <div className="flex h-auto w-full flex-col gap-6">
            <div className="flex justify-between items-center">
              <div className="flex flex-col gap-2">
                <h4 className="h4 font-semibold">{t("QA.header")}</h4>
                <h5 className="text-xl">{t("QA.subHeader")}</h5>
              </div>
              {isAdmin && (
                <Link to="/qa/new" className="ml-2">
                  <Button>{t("qaView.button.createNew")}</Button>
                </Link>
              )}
            </div>
            {filteredQA && filteredQA.length > 0 && (
              <div className="rounded-2xl bg-white border-border border overflow-hidden">
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  value={openItem}
                  onValueChange={(value) => setOpenItem(value || undefined)}
                >
                  {filteredQA?.map((item) => (
                    <QAItem
                      key={item.id}
                      id={item.id}
                      title={item.title}
                      description={item.description}
                      isAdmin={isAdmin}
                      availableLocales={item.availableLocales}
                    />
                  ))}
                </Accordion>
              </div>
            )}
          </div>
        </div>
      </PageWrapper>
    </ContentAccessGuard>
  );
}
