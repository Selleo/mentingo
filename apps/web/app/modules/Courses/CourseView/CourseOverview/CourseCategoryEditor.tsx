import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import { formatDurationToHalfHour } from "~/modules/Courses/utils/formatDuration";

type CategoryOption = {
  id: string;
  title: string;
};

type CourseCategoryEditorProps = {
  canEdit: boolean;
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

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      {canEdit && isEditing ? (
        <Select
          open={isEditing}
          value={categoryId}
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
            className="h-8 w-auto min-w-40 rounded-full border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-950 shadow-lg transition-colors hover:bg-neutral-50 focus:ring-2 focus:ring-white/70"
          >
            <SelectValue placeholder={categoryTitle} />
          </SelectTrigger>

          <SelectContent className="border-neutral-200 bg-white text-neutral-950 shadow-xl">
            {categories.map((category) => (
              <SelectItem
                key={category.id}
                value={category.id}
                className="cursor-pointer focus:bg-neutral-100 focus:text-neutral-950"
              >
                {category.title}
              </SelectItem>
            ))}
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
            "rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-all duration-200",
            {
              "cursor-pointer outline-2 outline-dashed outline-transparent hover:bg-white/30 hover:outline-white focus-visible:bg-white/30 focus-visible:outline-white":
                canEdit,
            },
          )}
        >
          {categoryTitle}
        </button>
      )}

      <span className="flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
        <Clock className="size-3.5" />
        {formatDurationToHalfHour(durationSeconds, t)}
      </span>
    </div>
  );
}
