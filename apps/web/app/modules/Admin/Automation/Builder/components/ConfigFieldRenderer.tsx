import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import MultipleSelector from "~/components/ui/multiselect";
import { Textarea } from "~/components/ui/textarea";

import type { StepConfigField } from "../automationBuilder.types";
import type { FC } from "react";
import type { Option } from "~/components/ui/multiselect";

interface ConfigFieldRendererProps {
  field: StepConfigField;
  value: unknown;
  onChange: (value: unknown) => void;
  dynamicOptions?: Record<string, Option[]>;
}

export const ConfigFieldRenderer: FC<ConfigFieldRendererProps> = ({
  field,
  value,
  onChange,
  dynamicOptions,
}) => {
  const { t } = useTranslation();
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
      const selectedOption = options.filter((opt) => opt.value === value);

      return (
        <MultipleSelector
          value={selectedOption}
          options={options}
          placeholder={placeholder ?? t("courses.select")}
          maxSelected={1}
          onChange={(selected) => {
            onChange(selected[0]?.value ?? "");
          }}
          className="min-h-10 w-full"
        />
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
        <Input
          type="text"
          placeholder={placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "textarea":
      return (
        <Textarea
          rows={4}
          placeholder={placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
      return null;
  }
};
