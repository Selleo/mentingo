import { t } from "i18next";
import { useMemo, useState } from "react";

import { useBulkGroupCourseEnroll } from "~/api/mutations/admin/useBulkGroupCourseEnroll";
import { Icon } from "~/components/Icon";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

import type { FormEvent } from "react";
import type { GetAllGroupsResponse, GetGroupsByCourseResponse } from "~/api/generated-api";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  groups: GetAllGroupsResponse["data"];
  enrolledGroups?: GetGroupsByCourseResponse["data"];
};

export const GroupEnrollModal = ({
  isOpen,
  onOpenChange,
  courseId,
  groups,
  enrolledGroups,
}: Props) => {
  const { mutate: bulkGroupEnroll } = useBulkGroupCourseEnroll(courseId);

  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const enrolledIds = useMemo(
    () => new Set(enrolledGroups?.map((g) => g.id) ?? []),
    [enrolledGroups],
  );

  const toggleGroupEnrollment = (groupId: string, isChecked: boolean, disabled?: boolean) => {
    if (disabled) return;

    setSelectedGroupIds((prev) =>
      isChecked ? [...prev, groupId] : prev.filter((id) => id !== groupId),
    );
  };

  const handleGroupFormSubmit = (event: FormEvent) => {
    event.preventDefault();

    const groupIds = selectedGroupIds.filter(Boolean);

    if (groupIds.length > 0) {
      bulkGroupEnroll({ groupIds });
    }

    setSelectedGroupIds([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger>
        <Button variant="primary">{t("adminCourseView.enrolled.enrollGroups")}</Button>
      </DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="max-w-2xl">
          <DialogTitle>{t("adminCourseView.enrolled.enrollGroupsModal.title")}</DialogTitle>
          <DialogDescription>
            {t("adminCourseView.enrolled.enrollGroupsModal.description")}
          </DialogDescription>

          <div className="mt-4 grid gap-3">
            {(groups || []).map((group) => {
              const isGroupEnrolled = enrolledIds.has(group.id);
              const isChecked = isGroupEnrolled || selectedGroupIds.includes(group.id);

              return (
                <div
                  key={group.id}
                  className="flex items-center justify-between gap-4 rounded-lg border bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={isChecked}
                      disabled={isGroupEnrolled}
                      onCheckedChange={(currentValue) =>
                        toggleGroupEnrollment(group.id, !!currentValue, isGroupEnrolled)
                      }
                      aria-label={`select-group-${group.id}`}
                    />
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100">
                        <Icon name="User" className="size-5 text-neutral-600" />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-neutral-900">{group.name}</div>
                        <div className="text-xs text-neutral-500">
                          {t("adminCourseView.enrolled.members", {
                            count: group.users?.length ?? 0,
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isGroupEnrolled && (
                      <Badge className="bg-primary-50 text-primary-700" fontWeight="normal">
                        {t("adminCourseView.enrolled.alreadyEnrolled")}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <form onSubmit={handleGroupFormSubmit}>
            <div className="flex justify-end gap-4 mt-6">
              <DialogClose>
                <Button type="reset" variant="ghost">
                  {t("common.button.cancel")}
                </Button>
              </DialogClose>
              <Button type="submit" variant="primary" disabled={!selectedGroupIds.length}>
                {t("adminCourseView.enrolled.enrollGroups")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};
