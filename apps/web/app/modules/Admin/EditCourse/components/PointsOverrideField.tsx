import { useTranslation } from "react-i18next";

import { FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";

import type { FieldValues, Path, PathValue, UseFormReturn } from "react-hook-form";

type PointsOverrideFieldProps<TFormValues extends FieldValues> = {
  form: UseFormReturn<TFormValues>;
  name: Path<TFormValues>;
};

export function PointsOverrideField<TFormValues extends FieldValues>({
  form,
  name,
}: PointsOverrideFieldProps<TFormValues>) {
  const { t } = useTranslation();
  const value = form.watch(name) as number | null | undefined;
  const usesTenantDefault = value === null || value === undefined;

  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor={`${name}-use-default`} className="body-base-md text-neutral-950">
            {t("adminCourseView.gamification.pointsOverride.useTenantDefault")}
          </Label>
          <p className="body-sm text-neutral-600">
            {t("adminCourseView.gamification.pointsOverride.description")}
          </p>
        </div>
        <Switch
          id={`${name}-use-default`}
          checked={usesTenantDefault}
          onCheckedChange={(checked) => {
            form.setValue(name, (checked ? null : 0) as PathValue<TFormValues, typeof name>, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }}
        />
      </div>

      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem className="mt-4 max-w-xs">
            <Label htmlFor={`${name}-points`}>
              {t("adminCourseView.gamification.pointsOverride.pointsLabel")}
            </Label>
            <FormControl>
              <Input
                id={`${name}-points`}
                type="number"
                min={0}
                step={1}
                disabled={usesTenantDefault}
                value={usesTenantDefault ? "" : field.value}
                placeholder={t("adminCourseView.gamification.pointsOverride.defaultPlaceholder")}
                onChange={(event) => {
                  const nextValue = event.target.value === "" ? 0 : Number(event.target.value);
                  field.onChange(nextValue);
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
