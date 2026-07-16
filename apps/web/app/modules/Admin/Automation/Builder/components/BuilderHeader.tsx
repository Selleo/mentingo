import { useNavigate } from "@remix-run/react";
import { ArrowLeft, ChevronRight, Play, Save, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { cn } from "~/lib/utils";

import { useBuilderStore } from "../automationBuilderStore";

import type { FC } from "react";

interface BuilderHeaderProps {
  automationId: string;
}

export const BuilderHeader: FC<BuilderHeaderProps> = ({ automationId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const automationName = useBuilderStore((s) => s.automationName);
  const isActive = useBuilderStore((s) => s.isActive);
  const lastSavedAt = useBuilderStore((s) => s.lastSavedAt);
  const setActive = useBuilderStore((s) => s.setActive);
  const markSaved = useBuilderStore((s) => s.markSaved);

  const handleBack = () => {
    navigate("/admin/automation");
  };

  const handleSave = () => {
    markSaved();
  };

  const handleSimulate = () => {
    console.log("Simulate automation:", automationId);
  };

  const formatSavedTime = () => {
    if (!lastSavedAt) return null;
    const date = new Date(lastSavedAt);
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return t("automationBuilder.header.savedJustNow");
    return t("automationBuilder.header.savedMinutesAgo", { count: minutes });
  };

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          aria-label={t("automationBuilder.header.back")}
        >
          <ArrowLeft className="size-5" />
        </Button>

        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <button onClick={handleBack} className="hover:text-foreground transition-colors">
            {t("automationBuilder.header.automations")}
          </button>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">{automationName}</span>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {lastSavedAt && <span className="text-xs text-muted-foreground">{formatSavedTime()}</span>}

        <Button variant="outline" size="sm" onClick={handleSave}>
          <Save className="mr-1.5 size-4" />
          {t("automationBuilder.header.save")}
        </Button>

        <Button variant="outline" size="sm" onClick={handleSimulate}>
          <Play className="mr-1.5 size-4" />
          {t("automationBuilder.header.simulate")}
        </Button>

        <div className="flex items-center gap-2">
          <span
            className={cn("text-xs font-medium", isActive ? "text-success-600" : "text-amber-600")}
          >
            {isActive ? t("automationBuilder.header.active") : t("automationBuilder.header.draft")}
          </span>
          <Switch checked={isActive} onCheckedChange={setActive} />
        </div>

        <Button variant="destructive" size="sm">
          <Trash2 className="mr-1.5 size-4" />
          {t("automationBuilder.header.delete")}
        </Button>
      </div>
    </header>
  );
};
