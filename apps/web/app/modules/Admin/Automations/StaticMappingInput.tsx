import { AUTOMATION_PLACEHOLDER_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import type {
  AutomationPlaceholderDefinition,
  AutomationPlaceholderValue,
  SupportedLanguages,
} from "@repo/shared";

interface StaticMappingInputProps {
  placeholder: AutomationPlaceholderDefinition;
  value: AutomationPlaceholderValue | undefined;
  onChange: (value: AutomationPlaceholderValue) => void;
  onValidityChange?: (valid: boolean) => void;
}

function isLocalizedValue(value: AutomationPlaceholderValue) {
  if (typeof value === "string") return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  return (
    Object.entries(value).length > 0 &&
    Object.entries(value).every(
      ([language, text]) =>
        Object.values(SUPPORTED_LANGUAGES).includes(language as SupportedLanguages) &&
        typeof text === "string",
    )
  );
}

export function StaticMappingInput({
  placeholder,
  value,
  onChange,
  onValidityChange,
}: StaticMappingInputProps) {
  const { t } = useTranslation();
  const isStructured =
    placeholder.type === AUTOMATION_PLACEHOLDER_TYPES.COLLECTION ||
    placeholder.type === AUTOMATION_PLACEHOLDER_TYPES.LOCALIZED_STRING;
  const [text, setText] = useState(() =>
    isStructured ? JSON.stringify(value ?? placeholder.sampleValue) : String(value ?? ""),
  );
  const [invalid, setInvalid] = useState(false);

  function setValidity(valid: boolean) {
    setInvalid(!valid);
    onValidityChange?.(valid);
  }

  function edit(next: string) {
    setText(next);

    if (isStructured) {
      try {
        const parsed = JSON.parse(next) as AutomationPlaceholderValue;
        const valid =
          placeholder.type === AUTOMATION_PLACEHOLDER_TYPES.COLLECTION
            ? Array.isArray(parsed)
            : isLocalizedValue(parsed);

        setValidity(valid);
        if (valid) onChange(parsed);
      } catch {
        setValidity(false);
      }

      return;
    }

    if (placeholder.type === AUTOMATION_PLACEHOLDER_TYPES.NUMBER) {
      const number = Number(next);
      const valid = Boolean(next.trim()) && Number.isFinite(number);

      setValidity(valid);
      if (valid) onChange(number);

      return;
    }

    if (placeholder.type === AUTOMATION_PLACEHOLDER_TYPES.URL) {
      try {
        const url = new URL(next);
        const valid = url.protocol === "http:" || url.protocol === "https:";

        setValidity(valid);
        if (valid) onChange(next);
      } catch {
        setValidity(false);
      }

      return;
    }

    setValidity(true);
    onChange(next);
  }

  if (placeholder.type === AUTOMATION_PLACEHOLDER_TYPES.BOOLEAN)
    return (
      <Select value={String(value ?? false)} onValueChange={(next) => onChange(next === "true")}>
        <SelectTrigger aria-label={placeholder.label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="false">false</SelectItem>
          <SelectItem value="true">true</SelectItem>
        </SelectContent>
      </Select>
    );

  return (
    <div className="space-y-1">
      <Input
        aria-label={placeholder.label}
        aria-invalid={invalid}
        value={text}
        onChange={(event) => edit(event.target.value)}
      />
      {invalid && (
        <p role="alert" className="text-xs text-destructive">
          {t("automationBuilder.editAction.invalidStaticValue", { type: placeholder.type })}
        </p>
      )}
    </div>
  );
}
