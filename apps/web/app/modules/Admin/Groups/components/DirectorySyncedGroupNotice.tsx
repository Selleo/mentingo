import { Link } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import GoogleLogo from "~/assets/svgs/google.svg?react";
import { Button } from "~/components/ui/button";
import { SETTINGS_TAB_QUERY_PARAM, SETTINGS_TABS } from "~/modules/Dashboard/Settings/constants";

import { GROUP_PAGE_HANDLES } from "../../../../../e2e/data/groups/handles";

/** Explains on the group page why membership changes and deletion are restricted. */
export function DirectorySyncedGroupNotice() {
  const { t } = useTranslation();

  return (
    <div
      className="flex flex-col gap-3 rounded-lg bg-white p-4 drop-shadow sm:flex-row sm:items-center"
      data-testid={GROUP_PAGE_HANDLES.DIRECTORY_SYNCED_NOTICE}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f0fe]">
        <GoogleLogo className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="body-sm-md text-neutral-950">{t("directorySync.group.syncedBadge")}</p>
        <p className="body-sm text-neutral-700">
          {t("directorySync.group.syncedNoticeDescription")}
        </p>
      </div>
      <Button asChild size="sm" variant="ghost" className="shrink-0">
        <Link
          to={`/settings?${SETTINGS_TAB_QUERY_PARAM}=${SETTINGS_TABS.INTEGRATIONS}#directory-sync`}
        >
          {t("directorySync.group.openSettings")}
        </Link>
      </Button>
    </div>
  );
}
