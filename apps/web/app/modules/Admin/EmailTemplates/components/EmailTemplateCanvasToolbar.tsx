import { Eye, Monitor, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export type EmailTemplateCanvasToolbarProps = {
  isMobilePreview: boolean;
  isPreviewMode: boolean;
  onMobileChange: (isMobilePreview: boolean) => void;
  onTogglePreview: () => void;
};

export function EmailTemplateCanvasToolbar({
  isMobilePreview,
  isPreviewMode,
  onMobileChange,
  onTogglePreview,
}: EmailTemplateCanvasToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center gap-1 border-b bg-white p-3">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-pressed={!isMobilePreview}
        className={cn("gap-2", { "bg-neutral-100": !isMobilePreview })}
        onClick={() => onMobileChange(false)}
      >
        <Monitor className="size-4" />
        {t("emailTemplates.ui.desktop")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-pressed={isMobilePreview}
        className={cn("gap-2", { "bg-neutral-100": isMobilePreview })}
        onClick={() => onMobileChange(true)}
      >
        <Smartphone className="size-4" />
        {t("emailTemplates.ui.mobile")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-pressed={isPreviewMode}
        className={cn("gap-2", { "bg-neutral-100": isPreviewMode })}
        onClick={onTogglePreview}
      >
        <Eye className="size-4" />
        {t("emailTemplates.ui.preview")}
      </Button>
    </div>
  );
}
