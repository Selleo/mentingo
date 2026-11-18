import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import type { ReactElement } from "react";
import type { ControllerRenderProps, Control, FieldPath, FieldValues } from "react-hook-form";

type TenantFormFieldProps<TValues extends FieldValues> = {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  hint?: string;
  className?: string;
  renderControl: (field: ControllerRenderProps<TValues, FieldPath<TValues>>) => ReactElement;
};

/** One labelled field in the user-page style: small uppercase label above the control. */
export function TenantFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  hint,
  className,
  renderControl,
}: TenantFormFieldProps<TValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn("space-y-0", className)}>
          <Label
            htmlFor={name}
            className="mb-2 inline-block text-xs font-semibold uppercase tracking-wide text-neutral-500"
          >
            {label}
          </Label>
          <FormControl>{renderControl(field)}</FormControl>
          {hint && <p className="mt-1.5 text-xs text-neutral-600">{hint}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
