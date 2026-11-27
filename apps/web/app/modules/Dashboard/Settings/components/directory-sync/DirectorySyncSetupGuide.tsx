import { Link } from "@remix-run/react";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { copyToClipboard } from "~/utils/copyToClipboard";

import { DIRECTORY_SYNC_NOTICE_TONES, DirectorySyncNotice } from "./DirectorySyncNotice";

import type { GetDirectorySyncSetupDetailsResponse } from "~/api/generated-api";

type SetupDetails = GetDirectorySyncSetupDetailsResponse["data"];

type DirectorySyncSetupGuideProps = {
  setupDetails: SetupDetails | undefined;
  isServiceAccountKeyMissing: boolean;
};

export function DirectorySyncSetupGuide({
  setupDetails,
  isServiceAccountKeyMissing,
}: DirectorySyncSetupGuideProps) {
  const { t } = useTranslation();

  if (isServiceAccountKeyMissing) {
    return (
      <DirectorySyncNotice
        tone={DIRECTORY_SYNC_NOTICE_TONES.WARNING}
        title={t("directorySync.setup.keyMissingTitle")}
      >
        <p className="text-neutral-700">{t("directorySync.setup.keyMissingDescription")}</p>
        <Button asChild size="sm" variant="outline" className="mt-2">
          <Link to="/admin/envs">{t("directorySync.setup.openEnvs")}</Link>
        </Button>
      </DirectorySyncNotice>
    );
  }

  if (!setupDetails) return null;

  return <DirectorySyncSetupInstructions setupDetails={setupDetails} />;
}

/** The steps, client ID and scopes to grant in the Google Admin console. */
export function DirectorySyncSetupInstructions({ setupDetails }: { setupDetails: SetupDetails }) {
  const { t } = useTranslation();

  const setupSteps = [
    t("directorySync.setup.stepOpenAdminConsole"),
    t("directorySync.setup.stepAddClient"),
    t("directorySync.setup.stepSaveAndVerify"),
  ];

  return (
    <div className="space-y-4 rounded-lg bg-neutral-50 p-4">
      <ol className="space-y-2">
        {setupSteps.map((setupStep, index) => (
          <li key={setupStep} className="flex gap-3 text-sm text-neutral-800">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-neutral-700 shadow-sm">
              {index + 1}
            </span>
            <span>{setupStep}</span>
          </li>
        ))}
      </ol>
      <div className="grid gap-3 md:grid-cols-2">
        <SetupValue label={t("directorySync.setup.clientId")} value={setupDetails.clientId} />
        <SetupValue label={t("directorySync.setup.scopes")} value={setupDetails.scopes.join(",")} />
      </div>
    </div>
  );
}

function SetupValue({ label, value }: { label: string; value: string }) {
  const { t } = useTranslation();

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white p-2">
        <code className="line-clamp-2 min-w-0 flex-1 break-all text-xs text-neutral-800">
          {value}
        </code>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 shrink-0 gap-1.5 px-2"
          onClick={() =>
            copyToClipboard(
              value,
              t("directorySync.toast.copySuccess"),
              t("directorySync.toast.copyError"),
            )
          }
        >
          <Copy className="size-4" aria-hidden="true" />
          {t("directorySync.setup.copy")}
        </Button>
      </div>
    </div>
  );
}
