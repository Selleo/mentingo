import { Link } from "@remix-run/react";
import { Clock, Pencil, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { formatDurationToHalfHour } from "~/modules/Courses/utils/formatDuration";

import { COURSE_SETTINGS_HANDLES } from "../../../../../e2e/data/courses/handles";

type CategoryOption = {
  id: string;
  title: string;
};

type CourseCategoryEditorProps = {
  canEdit: boolean;
  canManageCategories: boolean;
  categories: CategoryOption[];
  categoryId: string;
  categoryTitle: string;
  disabled: boolean;
  durationSeconds?: number;
  isEditing: boolean;
  onChange: (categoryId: string) => Promise<void>;
  onClose: () => void;
  onEdit: () => void;
};

export default function CourseCategoryEditor({
  canEdit,
  canManageCategories,
  categories,
  categoryId,
  categoryTitle,
  disabled,
  durationSeconds,
  isEditing,
  onChange,
  onClose,
  onEdit,
}: CourseCategoryEditorProps) {
  const { t } = useTranslation();
  const hasSelectedCategory = categories.some((category) => category.id === categoryId);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      {canEdit && isEditing ? (
        <Select
          open={isEditing}
          value={hasSelectedCategory ? categoryId : ""}
          disabled={disabled}
          onValueChange={(selectedCategoryId) => {
            void onChange(selectedCategoryId);
          }}
          onOpenChange={(open) => {
            if (!open) {
              onClose();
            }
          }}
        >
          <SelectTrigger
            id="course-category"
            data-testid={COURSE_SETTINGS_HANDLES.CATEGORY_SELECT}
            className="h-8 w-auto min-w-40 rounded-full border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-950 shadow-lg transition-colors hover:bg-neutral-50 focus:ring-2 focus:ring-white/70 data-[placeholder]:text-neutral-400"
          >
            <SelectValue placeholder={categoryTitle} />
          </SelectTrigger>

          <SelectContent className="border-neutral-200 bg-white text-neutral-950 shadow-xl">
            {categories.map((category) => (
              <SelectItem
                key={category.id}
                value={category.id}
                data-testid={COURSE_SETTINGS_HANDLES.categoryOption(category.title)}
                className="cursor-pointer focus:bg-neutral-100 focus:text-neutral-950"
              >
                {category.title}
              </SelectItem>
            ))}

            {canManageCategories && (
              <div className="mt-1 border-t border-neutral-200 pt-1">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-auto w-full justify-start rounded-sm px-2 py-1.5 text-sm"
                >
                  <Link to="/admin/categories">
                    <Settings className="mr-2 size-4" />
                    {t("modernCourseView.overview.manageCategories")}
                  </Link>
                </Button>
              </div>
            )}
          </SelectContent>
        </Select>
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => {
            if (canEdit) {
              onEdit();
            }
          }}
          className={cn(
            "rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm transition-all duration-200",
            {
              "cursor-pointer outline-2 outline-dashed outline-transparent hover:bg-white/30 hover:outline-white focus-visible:bg-white/30 focus-visible:outline-white":
                canEdit,
              "text-neutral-200": !hasSelectedCategory,
              "text-white": hasSelectedCategory,
            },
          )}
        >
          <span className="flex items-center gap-1.5">
            {categoryTitle}
            {canEdit && <Pencil aria-hidden className="size-3 shrink-0 text-white/80" />}
          </span>
        </button>
      )}

      <span className="flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
        <Clock className="size-3.5" />
        {formatDurationToHalfHour(durationSeconds, t)}
      </span>
    </div>
  );
}
