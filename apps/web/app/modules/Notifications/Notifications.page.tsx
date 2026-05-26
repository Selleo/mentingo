import { useTranslation } from "react-i18next";

import { PageWrapper } from "~/components/PageWrapper";
import { setPageTitle } from "~/utils/setPageTitle";

import { NOTIFICATIONS_POPOVER_VARIANT, NotificationsPopover } from "./components";
import { NOTIFICATIONS_HANDLES } from "./handles";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.notifications");

export default function NotificationsPage() {
  const { t } = useTranslation();

  return (
    <PageWrapper
      role="main"
      data-testid={NOTIFICATIONS_HANDLES.PAGE}
      breadcrumbs={[
        {
          title: t("notifications.title"),
          href: "/notifications",
        },
      ]}
      className="bg-neutral-50/70 mb-8"
    >
      <div className="mx-auto w-full max-w-3xl">
        <NotificationsPopover variant={NOTIFICATIONS_POPOVER_VARIANT.PAGE} />
      </div>
    </PageWrapper>
  );
}
