import { useId, useLayoutEffect, useRef } from "react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import { EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE } from "../emailTemplates.constants";
import { getEmailTemplateVariableRanges } from "../emailTemplateVariableHighlight.utils";

import type { EmailTemplateVariables } from "../emailTemplates.types";

export type EmailTemplateTextFieldProps = {
  label: string;
  testId?: string;
  value: string;
  onChange: (value: string) => void;
  variables?: EmailTemplateVariables;
  disabled?: boolean;
  stacked?: boolean;
  compact?: boolean;
  dense?: boolean;
  highlightVariables?: boolean;
};

export function EmailTemplateTextField({
  label,
  testId,
  value,
  onChange,
  variables,
  disabled = false,
  stacked = false,
  compact = false,
  dense = false,
  highlightVariables = false,
}: EmailTemplateTextFieldProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightOverlayRef = useRef<HTMLDivElement>(null);
  const variableRanges = highlightVariables
    ? getEmailTemplateVariableRanges(value, variables ?? [])
    : [];
  const highlightBoundaries = [
    0,
    ...variableRanges.flatMap(({ from, to }) => [from, to]),
    value.length,
  ];
  const handleHighlightScroll = () => {
    if (highlightOverlayRef.current && inputRef.current)
      highlightOverlayRef.current.scrollLeft = inputRef.current.scrollLeft;
  };
  useLayoutEffect(handleHighlightScroll, [value]);
  return (
    <div
      className={cn("min-w-0", {
        "space-y-2": !compact && !dense,
        "flex flex-col gap-3": !compact && dense,
        "flex-1": compact,
      })}
    >
      <Label htmlFor={id} className={cn({ "sr-only": compact, "text-xs": dense })}>
        {label}
      </Label>
      <div className={cn("relative flex flex-col gap-2", { "sm:flex-row": !stacked })}>
        {highlightVariables && (
          <div
            ref={highlightOverlayRef}
            aria-hidden="true"
            className={cn(
              "body-base pointer-events-none absolute inset-0 overflow-hidden whitespace-pre rounded-lg border border-transparent px-3 py-2 text-sm text-neutral-950",
              { "opacity-50": disabled, "py-1": dense },
            )}
          >
            {highlightBoundaries.slice(0, -1).map((from, index) => (
              <span
                key={index}
                className={cn({
                  "text-primary-700": variableRanges.some(
                    (range) => from >= range.from && from < range.to,
                  ),
                })}
              >
                {value.slice(from, highlightBoundaries[index + 1])}
              </span>
            ))}
          </div>
        )}
        <Input
          id={id}
          data-testid={testId}
          ref={inputRef}
          className={cn({
            "h-8": compact || dense,
            "py-1": dense,
            "bg-transparent text-transparent caret-neutral-950": highlightVariables,
          })}
          placeholder={compact ? label : undefined}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onScroll={handleHighlightScroll}
          onSelect={handleHighlightScroll}
          onDragOver={(event) => {
            if (
              !disabled &&
              variables &&
              event.dataTransfer.types.includes(EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE)
            ) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={(event) => {
            const variableKey = event.dataTransfer.getData(EMAIL_TEMPLATE_VARIABLE_DRAG_TYPE);
            if (!variableKey) return;
            event.preventDefault();
            if (disabled || !variables?.some((variable) => variable.key === variableKey)) return;
            const token = `{{ ${variableKey} }}`;
            const selectionStart = inputRef.current?.selectionStart ?? value.length;
            const selectionEnd = inputRef.current?.selectionEnd ?? selectionStart;
            onChange(value.slice(0, selectionStart) + token + value.slice(selectionEnd));
            requestAnimationFrame(() => {
              inputRef.current?.focus();
              inputRef.current?.setSelectionRange(
                selectionStart + token.length,
                selectionStart + token.length,
              );
            });
          }}
        />
      </div>
    </div>
  );
}
