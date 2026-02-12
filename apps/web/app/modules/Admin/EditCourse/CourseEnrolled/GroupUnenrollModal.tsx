import { Minus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useUnenrollGroupsFromCourse } from "~/api/mutations/admin/useUnenrollGroupsFromCourse";
import { Icon } from "~/components/Icon";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

import type { FormEvent } from "react";
import type { GetGroupsByCourseResponse } from "~/api/generated-api";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  enrolledGroups?: GetGroupsByCourseResponse["data"];
  renderTrigger?: boolean;
};

export const GroupUnenrollModal = ({
  isOpen,
  onOpenChange,
  courseId,
  enrolledGroups,
  renderTrigger = true,
}: Props) => {
  const { t } = useTranslation();
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const { mutate: unenrollGroups, isPending } = useUnenrollGroupsFromCourse(courseId);

  const toggleGroupSelection = (groupId: string, isChecked: boolean) => {
    setSelectedGroupIds((prev) =>
      isChecked ? [...prev, groupId] : prev.filter((id) => id !== groupId),
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const groupIds = selectedGroupIds.filter(Boolean);

    if (groupIds.length > 0) {
      unenrollGroups({ groupIds });
    }

    setSelectedGroupIds([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {renderTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            disabled={!enrolledGroups?.length}
            className="gap-2 text-error-700 hover:text-error-700"
          >
            <Minus className="size-4 text-error-700" />
            {t("adminCourseView.enrolled.unenrollGroups")}
          </Button>
        </DialogTrigger>
      )}
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="max-w-2xl">
          <DialogTitle>{t("adminCourseView.enrolled.unenrollConfirmation.title")}</DialogTitle>
          <DialogDescription>
            {t("adminCourseView.enrolled.unenrollConfirmation.description")}
          </DialogDescription>

          <div className="mt-4 grid gap-3">
            {(enrolledGroups || []).map((group) => {
              const isChecked = selectedGroupIds.includes(group.id);

              return (
                <div
                  key={group.id}
                  className="flex items-center justify-between gap-4 rounded-lg border bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(currentValue) =>
                        toggleGroupSelection(group.id, !!currentValue)
                      }
                      aria-label={`select-group-${group.id}`}
                    />
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-100">
                        <Icon name="User" className="size-5 text-neutral-600" />
                      </div>
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-neutral-900">{group.name}</div>
                        {group.characteristic && (
                          <div className="text-xs text-neutral-500">{group.characteristic}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-primary-50 text-primary-700" fontWeight="normal">
                    {t("adminCourseView.enrolled.statuses.enrolled")}
                  </Badge>
                </div>
              );
            })}

            {!enrolledGroups?.length && (
              <div className="rounded-lg border border-dashed bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                {t("adminCourseView.statistics.empty.noGroups")}
              </div>
            )}
          </div>
          <form onSubmit={handleSubmit}>
            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                variant="destructive"
                disabled={!selectedGroupIds.length || isPending}
              >
                {t("adminCourseView.enrolled.unenrollSelected")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};
