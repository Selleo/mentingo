import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";

import type { GetLoginPageFilesResponse } from "~/api/generated-api";

export type LoginPageResource = GetLoginPageFilesResponse["resources"][number];

interface UploadFilesToLoginPageItemProps {
  resource: LoginPageResource;
  onPreview: (resource: LoginPageResource) => void;
  onDelete: (resource: LoginPageResource) => void;
}

export const UploadFilesToLoginPageItem = ({
  resource,
  onPreview,
  onDelete,
}: UploadFilesToLoginPageItemProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-white px-4 py-3 shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/40">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
          <Icon name="Article" className="size-5" />
        </div>
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => onPreview(resource)}
            className="body-base-md block w-full truncate text-left text-neutral-900 underline-offset-2 hover:underline"
          >
            {resource.name}
          </button>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="size-8 text-destructive hover:bg-red-100 hover:text-destructive"
        aria-label={t("common.button.delete")}
        onClick={() => onDelete(resource)}
      >
        <Icon name="TrashIcon" className="size-4" />
      </Button>
    </div>
  );
};
