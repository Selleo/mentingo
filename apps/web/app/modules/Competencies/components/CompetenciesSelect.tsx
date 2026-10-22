import { useId } from "react";

import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export function CompetenciesSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel,
  disabled,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  emptyLabel?: string;
  disabled?: boolean;
  hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
        {label}
      </Label>
      <Select
        value={value || "__none__"}
        onValueChange={(value) => onChange(value === "__none__" ? "" : value)}
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          className="gap-2 text-left [&>span]:min-w-0 [&>span]:flex-1 [&>svg]:shrink-0"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {emptyLabel && <SelectItem value="__none__">{emptyLabel}</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
