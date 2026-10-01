import { COURSE_STATUSES } from "@repo/shared";
import { isEmpty } from "lodash-es";
import { Archive, ArchiveRestore, CopyPlus, FilePenLine, Tags, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useBulkArchiveCourse } from "~/api/mutations/admin/useBulkArchiveCourse";
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

const BULK_COURSE_ACTION = {
  DUPLICATE: "duplicate",
  CHANGE_CATEGORY: "changeCategory",
  CHANGE_STATUS: "changeStatus",
  ARCHIVE: "archive",
  RESTORE: "restore",
  DELETE: "delete",
} as const;

type BulkCourseAction = (typeof BULK_COURSE_ACTION)[keyof typeof BULK_COURSE_ACTION];

type CourseCategory = GetAllCategoriesResponse["data"][number];

const COURSE_STATUS_OPTIONS = [
  COURSE_STATUSES.DRAFT,
  COURSE_STATUSES.PRIVATE,
  COURSE_STATUSES.PUBLISHED,
] as const;

type CourseBulkActionsProps = {
  selectedCourseIds: string[];
  selectedArchivedStates: boolean[];
  categories: CourseCategory[];
  onBulkActionComplete: () => void;
  onDuplicateCourse?: (courseId: string) => void;
  rowAction?: boolean;
  triggerTestId?: string;
};

export const CourseBulkActions = ({
  selectedCourseIds,
  selectedArchivedStates,
  categories,
  onBulkActionComplete,
  onDuplicateCourse,
  rowAction = false,
  triggerTestId,
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
  const { mutateAsync: bulkArchiveCourse, isPending: isArchivePending } = useBulkArchiveCourse();
  const isBulkActionPending =
    isBulkCategoryUpdatePending || isBulkStatusUpdatePending || isArchivePending;

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
    setSelectedBulkAction(BULK_COURSE_ACTION.CHANGE_CATEGORY);
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

    if (selectedBulkAction === BULK_COURSE_ACTION.DELETE) {
      handleDeleteCourses();
      return;
    }

    if (selectedBulkAction === BULK_COURSE_ACTION.CHANGE_CATEGORY) {
      await handleBulkCategoryUpdate();
      return;
    }

    if (
      selectedBulkAction === BULK_COURSE_ACTION.ARCHIVE ||
      selectedBulkAction === BULK_COURSE_ACTION.RESTORE
    ) {
      await bulkArchiveCourse({
        ids: selectedCourseIds,
        isArchived: selectedBulkAction === BULK_COURSE_ACTION.ARCHIVE,
      });
      onBulkActionComplete();
      resetBulkActionState();
      return;
    }

    await handleBulkStatusUpdate();
  };

  const bulkDropdownItems: BulkEditDropdownItem[] = [
    ...(onDuplicateCourse
      ? [
          {
            icon: <CopyPlus className="size-4 shrink-0" />,
            translationKey: "adminCourseDuplication.duplicate",
            action: () => onDuplicateCourse(selectedCourseIds[0] ?? ""),
            destructive: false,
            testId: COURSES_PAGE_HANDLES.DUPLICATE_ACTION,
          },
        ]
      : []),
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
      action: () => setSelectedBulkAction(BULK_COURSE_ACTION.CHANGE_STATUS),
      destructive: false,
      testId: COURSES_PAGE_HANDLES.BULK_EDIT_STATUS_ACTION,
    },
    ...(!selectedArchivedStates.every(Boolean)
      ? [
          {
            icon: <Archive className="size-4 shrink-0" />,
            translationKey: "adminCoursesView.dropdown.archive",
            action: () => setSelectedBulkAction(BULK_COURSE_ACTION.ARCHIVE),
            destructive: true,
            testId: COURSES_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION,
          },
        ]
      : []),
    ...(selectedArchivedStates.some(Boolean)
      ? [
          {
            icon: <ArchiveRestore className="size-4 shrink-0" />,
            translationKey: "adminCoursesView.dropdown.restore",
            action: () => setSelectedBulkAction(BULK_COURSE_ACTION.RESTORE),
            destructive: false,
            testId: COURSES_PAGE_HANDLES.BULK_EDIT_RESTORE_ACTION,
          },
        ]
      : []),
    {
      icon: <Trash2 className="size-4 shrink-0" />,
      translationKey: "adminCoursesView.dropdown.delete",
      action: () => setSelectedBulkAction(BULK_COURSE_ACTION.DELETE),
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

    if (selectedBulkAction === BULK_COURSE_ACTION.DELETE) {
      return getDeleteModalTitle();
    }

    if (selectedBulkAction === BULK_COURSE_ACTION.CHANGE_CATEGORY) {
      return t("adminCoursesView.categoryModal.title");
    }

    if (selectedBulkAction === BULK_COURSE_ACTION.ARCHIVE) {
      return t("adminCoursesView.archiveModal.title");
    }
    if (selectedBulkAction === BULK_COURSE_ACTION.RESTORE) {
      return t("adminCoursesView.restoreModal.title");
    }

    return t("adminCoursesView.statusModal.title");
  };

  const getDialogTestId = () => {
    if (
      selectedBulkAction === BULK_COURSE_ACTION.ARCHIVE ||
      selectedBulkAction === BULK_COURSE_ACTION.RESTORE
    )
      return COURSES_PAGE_HANDLES.ARCHIVE_DIALOG;
    if (selectedBulkAction === BULK_COURSE_ACTION.DELETE) return COURSES_PAGE_HANDLES.DELETE_DIALOG;
    if (selectedBulkAction === BULK_COURSE_ACTION.CHANGE_CATEGORY) {
      return COURSES_PAGE_HANDLES.CATEGORY_DIALOG;
    }

    return COURSES_PAGE_HANDLES.STATUS_DIALOG;
  };

  const getCancelButtonTestId = () => {
    if (
      selectedBulkAction === BULK_COURSE_ACTION.ARCHIVE ||
      selectedBulkAction === BULK_COURSE_ACTION.RESTORE
    )
      return COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CANCEL_BUTTON;
    if (selectedBulkAction === BULK_COURSE_ACTION.DELETE) {
      return COURSES_PAGE_HANDLES.DELETE_DIALOG_CANCEL_BUTTON;
    }
    if (selectedBulkAction === BULK_COURSE_ACTION.CHANGE_CATEGORY) {
      return COURSES_PAGE_HANDLES.CATEGORY_DIALOG_CANCEL_BUTTON;
    }

    return COURSES_PAGE_HANDLES.STATUS_DIALOG_CANCEL_BUTTON;
  };

  const getConfirmButtonTestId = () => {
    if (
      selectedBulkAction === BULK_COURSE_ACTION.ARCHIVE ||
      selectedBulkAction === BULK_COURSE_ACTION.RESTORE
    )
      return COURSES_PAGE_HANDLES.ARCHIVE_DIALOG_CONFIRM_BUTTON;
    if (selectedBulkAction === BULK_COURSE_ACTION.DELETE) {
      return COURSES_PAGE_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON;
    }
    if (selectedBulkAction === BULK_COURSE_ACTION.CHANGE_CATEGORY) {
      return COURSES_PAGE_HANDLES.CATEGORY_DIALOG_CONFIRM_BUTTON;
    }

    return COURSES_PAGE_HANDLES.STATUS_DIALOG_CONFIRM_BUTTON;
  };

  const getBulkActionModalDescription = () => {
    if (!selectedBulkAction) return "";

    if (selectedBulkAction === BULK_COURSE_ACTION.DELETE) {
      return getDeleteModalDescription();
    }

    if (selectedBulkAction === BULK_COURSE_ACTION.CHANGE_CATEGORY) {
      return t("adminCoursesView.categoryModal.description", {
        count: selectedCourseIds.length,
      });
    }

    if (selectedBulkAction === BULK_COURSE_ACTION.ARCHIVE) {
      return t("adminCoursesView.archiveModal.description", { count: selectedCourseIds.length });
    }
    if (selectedBulkAction === BULK_COURSE_ACTION.RESTORE) {
      return t("adminCoursesView.restoreModal.description", { count: selectedCourseIds.length });
    }

    return t("adminCoursesView.statusModal.description", {
      count: selectedCourseIds.length,
    });
  };

  const isConfirmDisabled =
    isBulkActionPending ||
    (selectedBulkAction === BULK_COURSE_ACTION.CHANGE_CATEGORY && !selectedCategoryId);
  const isDestructiveAction =
    selectedBulkAction === BULK_COURSE_ACTION.ARCHIVE ||
    selectedBulkAction === BULK_COURSE_ACTION.DELETE;

  const getConfirmLabel = () => {
    if (selectedBulkAction === BULK_COURSE_ACTION.DELETE) return t("common.button.delete");
    if (selectedBulkAction === BULK_COURSE_ACTION.ARCHIVE) {
      return t("adminCoursesView.dropdown.archive");
    }
    if (selectedBulkAction === BULK_COURSE_ACTION.RESTORE) {
      return t("adminCoursesView.dropdown.restore");
    }
    return t("common.button.save");
  };

  return (
    <div
      className={cn("ml-auto flex items-center gap-x-2 px-4 py-2", {
        "flex items-center justify-end gap-2 p-0 text-right": rowAction,
      })}
    >
      {!rowAction && (
        <p
          className={cn("text-sm", {
            "text-neutral-900": !isEmpty(selectedCourseIds),
            "text-neutral-500": isEmpty(selectedCourseIds),
          })}
        >
          {t("common.other.selected")} ({selectedCourseIds.length})
        </p>
      )}

      <BulkEditDropdown
        dropdownItems={bulkDropdownItems}
        disabled={isEmpty(selectedCourseIds)}
        triggerTestId={triggerTestId ?? COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER}
        triggerTranslationKey="adminCoursesView.button.bulkEdit"
        triggerAriaLabel={t("adminCoursesView.button.actions")}
        iconOnly={rowAction}
        stopTriggerPropagation={rowAction}
      />

      <Dialog
        open={Boolean(selectedBulkAction)}
        onOpenChange={(open) => {
          if (!open) resetBulkActionState();
        }}
      >
        <DialogPortal>
          <DialogOverlay
            className={cn("bg-primary-400 opacity-65", {
              "course-row-action-overlay": rowAction,
            })}
            data-course-row-action={rowAction ? "true" : undefined}
            onClick={
              rowAction
                ? (event) => {
                    event.stopPropagation();
                  }
                : undefined
            }
            onPointerDown={
              rowAction
                ? (event) => {
                    event.stopPropagation();
                  }
                : undefined
            }
          />
          <DialogContent
            data-testid={getDialogTestId()}
            data-course-row-action={rowAction ? "true" : undefined}
            className="max-w-lg gap-0 overflow-hidden p-0"
            overlayClassName={rowAction ? "course-row-action-overlay" : undefined}
            onClick={
              rowAction
                ? (event) => {
                    event.stopPropagation();
                  }
                : undefined
            }
            onPointerDown={
              rowAction
                ? (event) => {
                    event.stopPropagation();
                  }
                : undefined
            }
          >
            <div className="px-6 pb-4 pt-6">
              <DialogTitle className="pr-8 text-xl font-semibold text-neutral-950">
                {getBulkActionModalTitle()}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-[28rem] text-sm leading-6 text-neutral-600">
                {getBulkActionModalDescription()}
              </DialogDescription>
            </div>
            {selectedBulkAction === BULK_COURSE_ACTION.CHANGE_CATEGORY && (
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
            {selectedBulkAction === BULK_COURSE_ACTION.CHANGE_STATUS && (
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
              <DialogClose asChild>
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
                  "bg-error-500 text-white hover:bg-error-600": isDestructiveAction,
                })}
                disabled={isConfirmDisabled}
              >
                {getConfirmLabel()}
              </Button>
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </div>
  );
};
