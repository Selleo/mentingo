import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { BaseEditor } from "~/components/RichText/Editor";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

import type { AiMentorConfigurationDraft } from "../aiMentorConfiguration.types";
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
