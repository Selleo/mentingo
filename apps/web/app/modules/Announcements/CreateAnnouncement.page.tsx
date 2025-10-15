import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateAnnouncement } from "~/api/mutations/admin/useCreateAnnouncement";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { TooltipProvider } from "~/components/ui/tooltip";
import { setPageTitle } from "~/utils/setPageTitle";

import { CreateAnnouncementForm } from "./components";
import { getAnnouncementsPageBreadcrumbs } from "./components/getAnnouncementsBreadcrumbs";
import { createAnnouncementSchema } from "./schemas/createAnnouncement.schema";

import type { MetaFunction } from "@remix-run/react";
import type { CreateAnnouncementBody } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "pages.createAnnouncement");

export default function AnnouncementsPage() {
  const { t } = useTranslation();

  const { mutate: createAnnouncement } = useCreateAnnouncement();

  const {
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<CreateAnnouncementBody>({
    resolver: zodResolver(createAnnouncementSchema(t)),
    defaultValues: {
      title: "",
      content: "",
      groupId: null,
    },
    mode: "onChange",
  });

  const onSubmit = (data: CreateAnnouncementBody) => {
    if (!data) return;

    createAnnouncement({ data });
    reset();
  };

  return (
    <PageWrapper breadcrumbs={getAnnouncementsPageBreadcrumbs(t, true)}>
      <TooltipProvider>
        <div className="mt-4 flex justify-center">
          <section className="flex w-full max-w-[720px] flex-col items-center gap-4">
            <div className="flex w-full flex-wrap items-center justify-between gap-x-4">
              <h1 className="h5 md:h3 text-neutral-950">{t("announcements.createPage.header")}</h1>
              <div className="flex items-center gap-3">
                <Link to="/announcements">
                  <Button variant="outline">{t("announcements.createPage.buttons.cancel")}</Button>
                </Link>
                <Button variant="default" onClick={handleSubmit(onSubmit)}>
                  {t("announcements.createPage.buttons.confirm")}
                </Button>
              </div>
            </div>
            <CreateAnnouncementForm control={control} errors={errors} />
          </section>
        </div>
      </TooltipProvider>
    </PageWrapper>
  );
}
