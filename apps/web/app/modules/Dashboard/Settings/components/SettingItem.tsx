import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

import type { ReactNode } from "react";

interface SettingItemProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
  icon?: ReactNode;
}
export function SettingItem({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  icon,
}: SettingItemProps) {
  return (
    <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="bg-muted/50 flex size-8 shrink-0 items-center justify-center rounded-lg">
            {icon}
          </div>
        )}
        <div className="space-y-0.5">
          <Label htmlFor={id} className="body-base-md">
            {label}
          </Label>
          <p className="body-sm-md text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
