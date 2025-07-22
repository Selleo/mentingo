import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

interface SettingItemProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: () => void;
}

export function SettingItem({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: SettingItemProps) {
  return (
    <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
