import { Input } from "~/components/ui/input";
import MultipleSelector, { type Option } from "~/components/ui/multiselect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type { StepConfigField } from "../automationBuilder.types";
import type { FC } from "react";

interface ConfigFieldRendererProps {
  field: StepConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
  t: (key: string) => string;
  dynamicOptions?: Record<string, Option[]>;
}

export const ConfigFieldRenderer: FC<ConfigFieldRendererProps> = ({
  field,
  value,
  onChange,
  t,
  dynamicOptions,
}) => {
  const placeholder = field.placeholderKey ? t(field.placeholderKey) : undefined;

  const options: Option[] =
    field.dataSource && dynamicOptions?.[field.dataSource]
      ? dynamicOptions[field.dataSource]
      : (field.options ?? []).map((opt) => ({
          label: opt.label ?? t(opt.labelKey),
          value: opt.value,
          ...(opt.imageUrl ? { imageUrl: opt.imageUrl } : {}),
        }));

  switch (field.type) {
    case "select": {
      return (
        <Select value={(value as string) ?? ""} onValueChange={(val) => onChange(val)}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder ?? t("courses.select")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                <span className="flex items-center gap-2">
                  {opt.imageUrl && (
                    <img
                      src={opt.imageUrl}
                      alt=""
                      className="size-5 shrink-0 rounded object-cover"
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    case "multiselect": {
      const selectedArray = Array.isArray(value) ? value : [];
      const selectedOptions = options.filter((opt) => selectedArray.includes(opt.value));

      return (
        <MultipleSelector
          value={selectedOptions}
          options={options}
          placeholder={placeholder ?? t("courses.select")}
          onChange={(selected) => {
            onChange(selected.map((s) => s.value));
          }}
          className="min-h-10 w-full"
        />
      );
    }

    case "number":
      return (
        <Input
          type="number"
          min={0}
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder={placeholder}
          value={value !== undefined && value !== null ? String(value) : ""}
          onChange={(e) => {
            const num = Number(e.target.value);
            onChange(e.target.value === "" ? undefined : Math.max(0, num));
          }}
        />
      );

    case "text":
      return (
        <input
          type="text"
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder={placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
      return null;
  }
};
