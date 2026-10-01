import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import { COURSE_STATUS_HANDLES } from "../../../../../e2e/data/courses/handles";

import type { CourseStatus } from "@repo/shared";

type CourseStatusCardProps = {
  checked: boolean;
  onChange: () => void;
  headerKey: string;
  bodyKey: string;
  id: CourseStatus;
  variant?: "legacy" | "settings";
};

const CourseStatusCard = ({
  checked,
  onChange,
  headerKey,
  bodyKey,
  id,
  variant = "legacy",
}: CourseStatusCardProps) => {
  const { t } = useTranslation();
  const isSettingsVariant = variant === "settings";

  return (
    <button
      data-testid={COURSE_STATUS_HANDLES.statusCard(id)}
      className={cn(
        "flex w-full cursor-pointer items-start gap-x-4 rounded-md border px-6 py-4 text-left",
        {
          "items-center gap-3 rounded-lg border-neutral-300 p-4 transition-colors hover:border-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500":
            isSettingsVariant,
          "border-primary-500 bg-primary-50/40": checked && isSettingsVariant,
          "border-primary-500": checked && !isSettingsVariant,
        },
      )}
      onClick={onChange}
      type="button"
    >
      <div className={cn("mt-1.5", { "mt-0": isSettingsVariant })}>
        <Input
          type="radio"
          name="status"
          checked={checked}
          onChange={onChange}
          className="size-4 cursor-pointer"
          id={id}
        />
      </div>
      <div className="min-w-0">
        <Label
          htmlFor={id}
          className={cn("cursor-pointer text-neutral-950", {
            "body-lg-md": !isSettingsVariant,
            "text-base font-semibold": isSettingsVariant,
          })}
        >
          <div
            className={cn("text-neutral-950", {
              "body-lg-md mb-2": !isSettingsVariant,
              "text-base font-semibold": isSettingsVariant,
            })}
          >
            {t(headerKey)}
          </div>
        </Label>
        <p
          className={cn("mt-1", {
            "body-base": !isSettingsVariant,
            "text-sm text-neutral-800": isSettingsVariant,
            "text-black": checked && !isSettingsVariant,
            "text-gray-500": !checked && !isSettingsVariant,
          })}
        >
          {t(bodyKey)}
        </p>
      </div>
    </button>
  );
};

export default CourseStatusCard;
