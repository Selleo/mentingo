import { GitBranch, Mail } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";

import type { ReactNode } from "react";

export function AddNodePicker({
  onSelect,
  trigger,
}: {
  onSelect: (type: "send_email" | "condition") => void;
  trigger: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 select-none p-2" align="start" side="right" sideOffset={8}>
        <p className="px-2 py-1.5 text-xs font-medium text-neutral-500">
          {t("automationBuilder.sidebar.actions")}
        </p>
        <button
          type="button"
          onClick={() => {
            onSelect("send_email");
            setOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-neutral-50"
        >
          <span className="flex size-6 items-center justify-center rounded bg-primary-50 text-primary-600">
            <Mail className="size-4" />
          </span>
          <span className="font-medium">{t("automations.sendEmail")}</span>
        </button>
        <p className="mt-2 border-t px-2 pb-1.5 pt-3 text-xs font-medium text-neutral-500">
          {t("automationBuilder.sidebar.logic")}
        </p>
        <button
          type="button"
          onClick={() => {
            onSelect("condition");
            setOpen(false);
          }}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-neutral-50"
        >
          <span className="flex size-6 items-center justify-center rounded bg-neutral-100 text-neutral-600">
            <GitBranch className="size-4" />
          </span>
          <span className="font-medium">{t("automationBuilder.condition.title")}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
