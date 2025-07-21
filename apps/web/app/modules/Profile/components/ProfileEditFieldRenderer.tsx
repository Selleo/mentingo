import { Controller } from "react-hook-form";

import { Icon } from "~/components/Icon";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

import type { UpdateUserProfileBody } from "../types";
import type { Control } from "react-hook-form";
import type { IconName } from "~/types/shared";

export type EditProfileFieldType = {
  name: keyof UpdateUserProfileBody;
  iconName?: IconName;
  type?: "email" | "text" | "textarea";
};

type FieldRendererProps = {
  field: EditProfileFieldType;
  control: Control<UpdateUserProfileBody>;
  user: UpdateUserProfileBody;
  t: (key: string) => string;
};

export const ProfileEditFieldRenderer = ({ field, control, user, t }: FieldRendererProps) => {
  const { name, iconName, type = "text" } = field;

  return (
    <Controller
      key={name}
      name={name}
      control={control}
      defaultValue={user[name] || ""}
      render={({ field: formField }) => (
        <div className="mb-4 flex flex-col gap-y-2">
          <Label htmlFor={name} className="body-base-md">
            {t(`contentCreatorView.field.${name}`)}
          </Label>

          {type === "textarea" ? (
            <Textarea
              {...formField}
              id={name}
              value={formField.value as string}
              className="min-h-[150px] w-full resize-none rounded-md border border-neutral-300 px-2 py-1"
              placeholder={t(`contentCreatorView.field.${name}Placeholder`)}
            />
          ) : (
            <div className="relative">
              <Input
                {...formField}
                id={name}
                value={formField.value as string}
                type={type}
                className="peer w-full rounded-md border border-neutral-300 px-2 py-1 ps-9"
                placeholder={t(`contentCreatorView.field.${name}Placeholder`)}
              />
              {iconName && (
                <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-2.5 peer-disabled:opacity-50">
                  <Icon name={iconName} className="size-5" />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    />
  );
};
