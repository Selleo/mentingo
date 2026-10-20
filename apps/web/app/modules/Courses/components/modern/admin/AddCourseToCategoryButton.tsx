import { Link } from "@remix-run/react";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

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

  return (
    <Link
      to={`/admin/beta-courses/new?categoryId=${categoryId}`}
      aria-label={t("studentCoursesView.modernView.inlineEdit.addCourseTo", {
        category: categoryTitle,
      })}
      className="body-base-md flex items-center gap-1.5 rounded-md text-neutral-400 transition-colors hover:text-primary-700 focus-visible:text-primary-700 focus-visible:outline-none md:group-hover/row:text-neutral-600"
      data-testid={COURSES_INLINE_EDIT_HANDLES.addCourseButton(categoryId)}
    >
      <Plus className="size-4" aria-hidden="true" />
      {t("studentCoursesView.modernView.inlineEdit.addCourse")}
    </Link>
  );
}
