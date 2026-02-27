import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

type CourseGenerationButtonProps = {
  className?: string;
  hidden?: boolean;
  onClick: () => void;
};

export function CourseGenerationButton({
  className,
  hidden = false,
  onClick,
}: CourseGenerationButtonProps) {
  const { t } = useTranslation();

  return (
    <div className={cn(className, hidden && "invisible pointer-events-none")}>
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        aria-label={t("adminCourseView.curriculum.chapter.button.generateWithAI")}
        className="w-full gap-2 rounded-lg px-4 py-2"
      >
        <Icon name="WandSparkles" className="size-4" />
        {t("adminCourseView.curriculum.chapter.button.generateWithAI")}
      </Button>
    </div>
  );
}
