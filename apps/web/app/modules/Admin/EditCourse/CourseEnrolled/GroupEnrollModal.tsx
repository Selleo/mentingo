import { t } from "i18next";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";

import { ScrollArea } from "~/components/ui/scroll-area";

import { useBulkGroupCourseEnroll } from "../../../../api/mutations/admin/useBulkGroupCourseEnroll";
import { Button } from "../../../../components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "../../../../components/ui/dialog";
import { Form } from "../../../../components/ui/form";

import { GroupEnrollItem } from "./GroupEnrollItem";

import type { GetAllGroupsResponse, GetGroupsByCourseResponse } from "~/api/generated-api";

type GroupFormItem = {
  id: string;
  selected: boolean;
  obligatory: boolean;
  deadline: string;
};

export type GroupEnrollFormValues = {
  groups: GroupFormItem[];
};

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  groups: GetAllGroupsResponse["data"];
  enrolledGroups?: GetGroupsByCourseResponse["data"];
  renderTrigger?: boolean;
};

export const GroupEnrollModal = ({
  isOpen,
  onOpenChange,
  courseId,
  groups,
  enrolledGroups,
  renderTrigger = true,
}: Props) => {
  const { mutate: bulkGroupEnroll } = useBulkGroupCourseEnroll(courseId);

  const enrolledIds = useMemo(
    () => new Set(enrolledGroups?.map((g) => g.id) ?? []),
    [enrolledGroups],
  );

  const form = useForm<GroupEnrollFormValues>({
    defaultValues: { groups: [] },
    mode: "onChange",
  });
  const watched = useWatch({ control: form.control, name: "groups" });
  const selectedCount = (watched ?? []).filter((g) => g?.selected).length;

  const handleSubmit = async (values: GroupEnrollFormValues) => {
    const formHasErrors = !!values.groups.find(
      (g) => g.selected && g.obligatory && (!g.deadline || Number.isNaN(Date.parse(g.deadline))),
    );
    if (formHasErrors) {
      await form.trigger();
      return;
    }

    const idsToEnroll = values.groups.filter((g) => g.selected).map((g) => g.id);

    if (idsToEnroll.length > 0) {
      bulkGroupEnroll(
        values.groups.map((g) => ({
          id: g.id,
          settings: {
            isMandatory: g.obligatory,
            dueDate: g.deadline,
          },
        })),
      );
    }
    onOpenChange(false);
  };

  useEffect(() => {
    const list =
      groups?.map((g) => ({
        id: g.id,
        selected: false,
        obligatory: false,
        deadline: "",
      })) ?? [];
    form.reset({ groups: list });
  }, [groups, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {renderTrigger && (
        <DialogTrigger>
          <Button variant="primary">{t("adminCourseView.enrolled.enrollGroups")}</Button>
        </DialogTrigger>
      )}
      <DialogPortal>
        <DialogOverlay />
        <DialogContent className="max-w-2xl gap-2">
          <DialogTitle>{t("adminCourseView.enrolled.enrollGroupsModal.title")}</DialogTitle>
          <DialogDescription className="leading-5">
            {t("adminCourseView.enrolled.enrollGroupsModal.description")}
          </DialogDescription>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
              <ScrollArea className="max-h-[60vh] h-[60vh]">
                <div className="mt-2 grid gap-3 pr-3">
                  {(groups || []).map((group, index) => {
                    const isGroupEnrolled = enrolledIds.has(group.id);
                    return (
                      <GroupEnrollItem
                        key={group.id}
                        index={index}
                        id={group.id}
                        name={group.name}
                        usersCount={group.users?.length ?? 0}
                        isGroupEnrolled={isGroupEnrolled}
                      />
                    );
                  })}
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-4 mt-6">
                <DialogClose>
                  <Button type="reset" variant="outline">
                    {t("common.button.cancel")}
                  </Button>
                </DialogClose>
                <Button type="submit" variant="primary" disabled={!selectedCount}>
                  {t("adminCourseView.enrolled.enrollGroups")} ({selectedCount})
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
};
