import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { BaseEditor } from "~/components/RichText/Editor";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { cn } from "~/lib/utils";

import type { AiMentorConfigurationDraft } from "../aiMentorConfiguration.types";
import type { LucideIcon } from "lucide-react";
import type { FieldPath } from "react-hook-form";

type ConfigurationTextFieldProps = {
  name: FieldPath<AiMentorConfigurationDraft>;
  label: string;
  placeholder: string;
  richText?: boolean;
  optional?: boolean;
  className?: string;
  testId?: string;
};

export const ConfigurationTextField = ({
  name,
  label,
  placeholder,
  richText = false,
  optional = false,
  className,
  testId,
}: ConfigurationTextFieldProps) => {
  const { t } = useTranslation();
  const form = useFormContext<AiMentorConfigurationDraft>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className={className}>
          <FormLabel>
            {label}
            {optional && (
              <span className="ml-1 font-normal text-neutral-500">
                {t("adminCourseView.curriculum.lesson.aiMentorConfiguration.optional")}
              </span>
            )}
          </FormLabel>
          <FormControl>
            {richText ? (
              <div data-testid={testId}>
                <BaseEditor
                  content={String(field.value ?? "")}
                  onChange={field.onChange}
                  ariaLabel={label}
                  parentClassName={cn("flex h-40 flex-col", {
                    "after:!ring-error-500": fieldState.invalid,
                  })}
                  contentClassName="min-h-0 flex-1 overflow-y-auto"
                  editorClassName="!min-h-0"
                  placeholder={placeholder}
                />
              </div>
            ) : (
              <Input
                {...field}
                value={String(field.value ?? "")}
                placeholder={placeholder}
                data-testid={testId}
                className={cn({ "border-error-500": fieldState.invalid })}
              />
            )}
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export type Choice<TValue extends string = string> = {
  value: TValue;
  label: string;
  description: string;
  icon?: LucideIcon;
};

type ConfigurationChoiceCardsProps<TValue extends string> = {
  name: "type" | "teachingStyle" | "difficulty";
  label: string;
  choices: Choice<TValue>[];
  columns: 2 | 3;
  disabled?: boolean;
  onValueChange?: (value: TValue) => void;
};

export const ConfigurationChoiceCards = <TValue extends string>({
  name,
  label,
  choices,
  columns,
  disabled = false,
  onValueChange,
}: ConfigurationChoiceCardsProps<TValue>) => {
  const form = useFormContext<AiMentorConfigurationDraft>();

  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <RadioGroup
              value={field.value}
              disabled={disabled}
              onValueChange={onValueChange ?? field.onChange}
              className={cn("grid grid-cols-1 gap-2", {
                "sm:grid-cols-2": columns === 2,
                "sm:grid-cols-3": columns === 3,
              })}
            >
              {choices.map((choice) => {
                const selected = choice.value === field.value;
                const choiceId = `ai-mentor-${name}-${choice.value}`;
                const ChoiceIcon = choice.icon;

                return (
                  <label
                    key={choice.value}
                    htmlFor={choiceId}
                    className={cn(
                      "flex min-h-20 cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition-colors",
                      {
                        "border-primary-600 bg-primary-50": selected,
                        "border-neutral-200 hover:border-neutral-300": !selected,
                        "cursor-not-allowed opacity-60": disabled,
                      },
                    )}
                  >
                    {ChoiceIcon && (
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700",
                          {
                            "bg-primary-100 text-primary-700": selected,
                          },
                        )}
                      >
                        <ChoiceIcon className="size-5" aria-hidden="true" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-neutral-950">
                        {choice.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-neutral-600">
                        {choice.description}
                      </span>
                    </span>
                    <RadioGroupItem
                      id={choiceId}
                      value={choice.value}
                      className="ml-auto mt-0.5 shrink-0"
                    />
                  </label>
                );
              })}
            </RadioGroup>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
