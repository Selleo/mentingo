import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

import type { InputHTMLAttributes } from "react";
import type { Control, FieldValues, Path } from "react-hook-form";

type FormTextareaFieldProps<T extends FieldValues> = InputHTMLAttributes<HTMLTextAreaElement> & {
  control: Control<T>;
  name: Path<T>;
  label?: string;
};

export const FormTextareaField = <T extends FieldValues>({
  control,
  name,
  label,
  ...props
}: FormTextareaFieldProps<T>) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        return (
          <FormItem>
            {label && (
              <Label htmlFor={name}>
                {props.required && <span className="text-error-600">* </span>}
                {label}
              </Label>
            )}
            <FormControl>
              <Textarea
                {...field}
                {...props}
                id={name}
                className="placeholder:body-base h-[164px] resize-none placeholder:text-neutral-600"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};
