import { COURSE_STATUSES } from "@repo/shared";
import { isEmpty } from "lodash-es";
import { FilePenLine, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useBulkUpdateCourseCategory } from "~/api/mutations/admin/useBulkUpdateCourseCategory";
import { useBulkUpdateCourseStatus } from "~/api/mutations/admin/useBulkUpdateCourseStatus";
import { useDeleteCourse } from "~/api/mutations/admin/useDeleteCourse";
import { useDeleteManyCourses } from "~/api/mutations/admin/useDeleteManyCourses";
import {
  type BulkEditDropdownItem,
  BulkEditDropdown,
} from "~/components/BulkEditDropdown/BulkEditDropdown";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import { COURSES_PAGE_HANDLES } from "../../../../../e2e/data/courses/handles";
import {
  getCourseBadgeIcon,
  getCourseBadgeIconClasses,
  getCourseBadgeVariant,
  getCourseStatus,
} from "../utils";

import type { GetAllCategoriesResponse } from "~/api/generated-api";
import type { CourseStatus } from "~/api/queries/useCourses";

enum BulkCourseAction {
  ChangeCategory = "changeCategory",
  ChangeStatus = "changeStatus",
  Delete = "delete",
}

type CourseCategory = GetAllCategoriesResponse["data"][number];

const COURSE_STATUS_OPTIONS = [
  COURSE_STATUSES.DRAFT,
  COURSE_STATUSES.PRIVATE,
  COURSE_STATUSES.PUBLISHED,
] as const;

type CourseBulkActionsProps = {
  selectedCourseIds: string[];
  categories: CourseCategory[];
  onBulkActionComplete: () => void;
};

export const CourseBulkActions = ({
  selectedCourseIds,
  categories,
  onBulkActionComplete,
}: CourseBulkActionsProps) => {
  const [selectedBulkAction, setSelectedBulkAction] = useState<BulkCourseAction | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<CourseStatus>(COURSE_STATUSES.DRAFT);
  const { t } = useTranslation();
  const { mutate: deleteCourse } = useDeleteCourse();
  const { mutate: deleteManyCourses } = useDeleteManyCourses();
  const { mutateAsync: bulkUpdateCourseCategory, isPending: isBulkCategoryUpdatePending } =
    useBulkUpdateCourseCategory();
  const { mutateAsync: bulkUpdateCourseStatus, isPending: isBulkStatusUpdatePending } =
    useBulkUpdateCourseStatus();
  const isBulkActionPending = isBulkCategoryUpdatePending || isBulkStatusUpdatePending;

  const resetBulkActionState = () => {
    setSelectedBulkAction(null);
    setSelectedCategoryId("");
    setSelectedStatus(COURSE_STATUSES.DRAFT);
  };

  const handleDeleteSuccess = () => {
    onBulkActionComplete();
    resetBulkActionState();
  };

  const handleOpenCategoryAction = () => {
    setSelectedCategoryId(categories[0]?.id ?? "");
    setSelectedBulkAction(BulkCourseAction.ChangeCategory);
  };

  const handleDeleteCourses = () => {
    if (selectedCourseIds.length === 0) return;

    if (selectedCourseIds.length === 1) {
      const [courseId] = selectedCourseIds;
      if (!courseId) return;

      deleteCourse(courseId, {
        onSuccess: handleDeleteSuccess,
      });
      return;
    }

    deleteManyCourses(selectedCourseIds, {
      onSuccess: handleDeleteSuccess,
    });
  };

  const handleBulkStatusUpdate = async () => {
    await bulkUpdateCourseStatus({
      ids: selectedCourseIds,
      status: selectedStatus,
    });

    onBulkActionComplete();
    resetBulkActionState();
  };

  const handleBulkCategoryUpdate = async () => {
    if (!selectedCategoryId) return;

    await bulkUpdateCourseCategory({
      ids: selectedCourseIds,
      categoryId: selectedCategoryId,
    });

    onBulkActionComplete();
    resetBulkActionState();
  };

  const handleConfirmBulkAction = async () => {
    if (!selectedBulkAction) return;

    if (selectedBulkAction === BulkCourseAction.Delete) {
      handleDeleteCourses();
      return;
    }

    if (selectedBulkAction === BulkCourseAction.ChangeCategory) {
      await handleBulkCategoryUpdate();
      return;
    }

    await handleBulkStatusUpdate();
  };

  const bulkDropdownItems: BulkEditDropdownItem[] = [
    {
      icon: <Tags className="size-4 shrink-0" />,
      translationKey: "adminCoursesView.dropdown.changeCategory",
      action: handleOpenCategoryAction,
      destructive: false,
      testId: COURSES_PAGE_HANDLES.BULK_EDIT_CATEGORY_ACTION,
    },
    {
      icon: <FilePenLine className="size-4 shrink-0" />,
      translationKey: "adminCoursesView.dropdown.changeStatus",
      action: () => setSelectedBulkAction(BulkCourseAction.ChangeStatus),
      destructive: false,
      testId: COURSES_PAGE_HANDLES.BULK_EDIT_STATUS_ACTION,
    },
    {
      icon: <Trash2 className="size-4 shrink-0" />,
      translationKey: "adminCoursesView.dropdown.delete",
      action: () => setSelectedBulkAction(BulkCourseAction.Delete),
      destructive: true,
      testId: COURSES_PAGE_HANDLES.BULK_EDIT_DELETE_ACTION,
    },
  ];

  const getDeleteModalTitle = () => {
    if (selectedCourseIds.length === 1) {
      return t("adminCoursesView.deleteModal.titleSingle");
    }
    return t("adminCoursesView.deleteModal.titleMultiple");
  };

  const getDeleteModalDescription = () => {
    if (selectedCourseIds.length === 1) {
      return t("adminCoursesView.deleteModal.descriptionSingle");
    }
    return t("adminCoursesView.deleteModal.descriptionMultiple", {
      count: selectedCourseIds.length,
    });
  };

  const getBulkActionModalTitle = () => {
    if (!selectedBulkAction) return "";

    if (selectedBulkAction === BulkCourseAction.Delete) {
      return getDeleteModalTitle();
    }

    if (selectedBulkAction === BulkCourseAction.ChangeCategory) {
      return t("adminCoursesView.categoryModal.title");
    }

    return t("adminCoursesView.statusModal.title");
  };

  const getDialogTestId = () => {
    if (selectedBulkAction === BulkCourseAction.Delete) return COURSES_PAGE_HANDLES.DELETE_DIALOG;
    if (selectedBulkAction === BulkCourseAction.ChangeCategory) {
      return COURSES_PAGE_HANDLES.CATEGORY_DIALOG;
    }

    return COURSES_PAGE_HANDLES.STATUS_DIALOG;
  };

  const getCancelButtonTestId = () => {
    if (selectedBulkAction === BulkCourseAction.Delete) {
      return COURSES_PAGE_HANDLES.DELETE_DIALOG_CANCEL_BUTTON;
    }
    if (selectedBulkAction === BulkCourseAction.ChangeCategory) {
      return COURSES_PAGE_HANDLES.CATEGORY_DIALOG_CANCEL_BUTTON;
    }

    return COURSES_PAGE_HANDLES.STATUS_DIALOG_CANCEL_BUTTON;
  };

  const getConfirmButtonTestId = () => {
    if (selectedBulkAction === BulkCourseAction.Delete) {
      return COURSES_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON;
    }
    if (selectedBulkAction === BulkCourseAction.ChangeCategory) {
      return COURSES_PAGE_HANDLES.CATEGORY_DIALOG_CONFIRM_BUTTON;
    }

    return COURSES_PAGE_HANDLES.STATUS_DIALOG_CONFIRM_BUTTON;
  };

  const getBulkActionModalDescription = () => {
    if (!selectedBulkAction) return "";

    if (selectedBulkAction === BulkCourseAction.Delete) {
      return getDeleteModalDescription();
    }

    if (selectedBulkAction === BulkCourseAction.ChangeCategory) {
      return t("adminCoursesView.categoryModal.description", {
        count: selectedCourseIds.length,
      });
    }

    return t("adminCoursesView.statusModal.description", {
      count: selectedCourseIds.length,
    });
  };

  const isConfirmDisabled =
    isBulkActionPending ||
    (selectedBulkAction === BulkCourseAction.ChangeCategory && !selectedCategoryId);

  return (
    <div className="ml-auto flex items-center gap-x-2 px-4 py-2">
      <p
        className={cn("text-sm", {
          "text-neutral-900": !isEmpty(selectedCourseIds),
          "text-neutral-500": isEmpty(selectedCourseIds),
        })}
      >
        {t("common.other.selected")} ({selectedCourseIds.length})
      </p>

      <BulkEditDropdown
        dropdownItems={bulkDropdownItems}
        disabled={isEmpty(selectedCourseIds)}
        triggerTestId={COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER}
        triggerTranslationKey="adminCoursesView.button.bulkEdit"
      />

      <Dialog
        open={Boolean(selectedBulkAction)}
        onOpenChange={(open) => {
          if (!open) resetBulkActionState();
        }}
      >
        <DialogPortal>
          <DialogOverlay className="bg-primary-400 opacity-65" />
          <DialogContent
            data-testid={getDialogTestId()}
            className="max-w-lg gap-0 overflow-hidden p-0"
          >
            <div className="px-6 pb-4 pt-6">
              <DialogTitle className="pr-8 text-xl font-semibold text-neutral-950">
                {getBulkActionModalTitle()}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-[28rem] text-sm leading-6 text-neutral-600">
                {getBulkActionModalDescription()}
              </DialogDescription>
            </div>
            {selectedBulkAction === BulkCourseAction.ChangeCategory && (
              <div className="border-y border-neutral-100 bg-neutral-50/70 px-6 py-5">
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger
                    data-testid={COURSES_PAGE_HANDLES.CATEGORY_SELECT}
                    className="bg-white"
                  >
                    <SelectValue placeholder={t("selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem
                        key={category.id}
                        data-testid={COURSES_PAGE_HANDLES.categoryOption(category.id)}
                        value={category.id}
                      >
                        {category.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedBulkAction === BulkCourseAction.ChangeStatus && (
              <div className="border-y border-neutral-100 bg-neutral-50/70 px-6 py-5">
                <RadioGroup
                  value={selectedStatus}
                  onValueChange={(status) => setSelectedStatus(status as CourseStatus)}
                  className="gap-3"
                >
                  {COURSE_STATUS_OPTIONS.map((status) => {
                    const isSelected = selectedStatus === status;

                    return (
                      <Label
                        key={status}
                        htmlFor={`bulk-course-status-${status}`}
                        className={cn(
                          "group flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:border-primary-200 hover:bg-primary-50/30",
                          {
                            "border-primary-500 bg-primary-50/40 ring-1 ring-primary-200":
                              isSelected,
                          },
                        )}
                      >
                        <Badge
                          variant={getCourseBadgeVariant(status)}
                          fontWeight="bold"
                          icon={getCourseBadgeIcon(status)}
                          iconClasses={getCourseBadgeIconClasses(status)}
                          className="min-w-0 justify-start"
                        >
                          {getCourseStatus(status, t)}
                        </Badge>
                        <RadioGroupItem
                          data-testid={COURSES_PAGE_HANDLES.statusOption(status)}
                          id={`bulk-course-status-${status}`}
                          value={status}
                          className={cn("size-5 border-neutral-300", {
                            "border-primary-700 text-primary-700": isSelected,
                          })}
                        />
                      </Label>
                    );
                  })}
                </RadioGroup>
              </div>
            )}
            <div className="flex justify-end gap-3 px-6 py-5">
              <DialogClose>
                <Button
                  data-testid={getCancelButtonTestId()}
                  variant="ghost"
                  className="text-primary-800"
                >
                  {t("common.button.cancel")}
                </Button>
              </DialogClose>
              <Button
                data-testid={getConfirmButtonTestId()}
                onClick={handleConfirmBulkAction}
                className={cn({
                  "bg-error-500 text-white hover:bg-error-600":
                    selectedBulkAction === BulkCourseAction.Delete,
                })}
                disabled={isConfirmDisabled}
              >
                {selectedBulkAction === BulkCourseAction.Delete
                  ? t("common.button.delete")
                  : t("common.button.save")}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
};
