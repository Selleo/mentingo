import { useTranslation } from "react-i18next";

import {
  getActivityLogDetailSections,
  type ActivityLogMetadataPayload,
  type ActivityLogActionType,
} from "../activityLogs.utils";

type ActivityLogMetadataProps = {
  metadata: ActivityLogMetadataPayload | null | undefined;
  actionType?: ActivityLogActionType | string | null;
};

const renderValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return <span className="text-neutral-400">-</span>;
  }

  if (typeof value === "object") {
    return (
      <pre className="max-w-full overflow-x-auto rounded-2xl bg-neutral-950 px-4 py-3 text-xs leading-5 text-neutral-50">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <span className="text-sm text-neutral-900">{String(value)}</span>;
};

export const ActivityLogMetadata = ({ metadata, actionType }: ActivityLogMetadataProps) => {
  const { t } = useTranslation();
  const sections = getActivityLogDetailSections(metadata, actionType);

  if (!sections.length) {
    return <p className="text-sm text-neutral-500">{t("activityLogsView.details.noMetadata")}</p>;
  }

  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {sections.map((section) => (
        <div key={section.key} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
            {t(`activityLogsView.details.${section.key}`)}
          </dt>
          <dd className="mt-1 text-sm leading-6 text-neutral-900">{renderValue(section.value)}</dd>
        </div>
      ))}
    </dl>
  );
};
