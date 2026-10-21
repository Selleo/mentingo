import { Link } from "@remix-run/react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { buildAddCourseFromCategoryPath } from "~/modules/Admin/AddCourse/utils/addCourseOrigin";

import { COURSES_INLINE_EDIT_HANDLES } from "../../../../../../e2e/data/courses/handles";

type AddCourseToCategoryButtonProps = {
  categoryId: string;
  categoryTitle: string;
};

export function AddCourseToCategoryButton({
  categoryId,
  categoryTitle,
}: AddCourseToCategoryButtonProps) {
  const { t } = useTranslation();
  const label = t("studentCoursesView.modernView.inlineEdit.addCourseTo", {
    category: categoryTitle,
  });

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to={buildAddCourseFromCategoryPath(categoryId)}
            aria-label={label}
            className="flex size-9 shrink-0 items-center justify-center self-center rounded-full border border-primary-300 bg-white text-primary-700 shadow-sm transition-colors hover:border-primary-500 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            data-testid={COURSES_INLINE_EDIT_HANDLES.addCourseButton(categoryId)}
          >
            <Plus className="size-5" aria-hidden="true" />
          </Link>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
        >
          {label}
          <TooltipArrow className="fill-black" />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
