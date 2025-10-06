import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

type CourseStatusCardProps = {
  checked: boolean;
  onChange: () => void;
  headerKey: string;
  bodyKey: string;
  id: string;
};

const CourseStatusCard = ({ checked, onChange, headerKey, bodyKey, id }: CourseStatusCardProps) => {
  const { t } = useTranslation();

  return (
    <button
      className={cn(
        "flex cursor-pointer items-start gap-x-4 rounded-md border px-6 py-4 text-left",
        {
          "border-primary-500": checked,
        },
      )}
      onClick={onChange}
      type="button"
    >
      <div className="mt-1.5">
        <Input
          type="radio"
          name="status"
          checked={checked}
          onChange={onChange}
          className="size-4 cursor-pointer p-1"
          id={id}
        />
      </div>
      <div>
        <Label htmlFor={id} className="body-lg-md cursor-pointer text-neutral-950">
          <div className="body-lg-md mb-2 text-neutral-950">{t(headerKey)}</div>
        </Label>
        <p
          className={cn("body-base mt-1", {
            "text-black": checked,
            "text-gray-500": !checked,
          })}
        >
          {t(bodyKey)}
        </p>
      </div>
    </button>
  );
};

export default CourseStatusCard;
