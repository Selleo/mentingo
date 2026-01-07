import { zodResolver } from "@hookform/resolvers/zod";
import { t } from "i18next";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

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

const groupItemSchema = z.object({
  id: z.string(),
  selected: z.boolean(),
  obligatory: z.boolean(),
  deadline: z.string().optional().nullable(),
});

const groupEnrollSchema = z
  .object({
    groups: z.array(groupItemSchema),
  })
  .superRefine((data, ctx) => {
    data.groups.forEach((g, index) => {
      if (!g.selected || !g.obligatory) return;

      if (!g.deadline) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("adminCourseView.deadlineRequired"),
          path: ["groups", index, "deadline"],
        });
        return;
      }

      if (Number.isNaN(Date.parse(g.deadline))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("adminCourseView.invalidDate"),
          path: ["groups", index, "deadline"],
        });
      }
    });
  });

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
    resolver: zodResolver(groupEnrollSchema),
  });

  const watched = useWatch({ control: form.control, name: "groups" });
  const selectedCount = (watched ?? []).filter((g) => g?.selected).length;

  const handleSubmit = async (values: GroupEnrollFormValues) => {
    const groupsToEnroll = values.groups.filter((g) => g.selected);

    if (groupsToEnroll.length > 0) {
      bulkGroupEnroll({
        groups: groupsToEnroll.map((g) => ({
          id: g.id,
          isMandatory: g.obligatory,
          dueDate: g.deadline,
        })),
      });
    }
    onOpenChange(false);
  };

  useEffect(() => {
    const list =
      groups?.map((g) => {
        const enrolled = enrolledGroups?.find((eg) => eg.id === g.id);
        const isMandatory = enrolled?.isMandatory;
        const dueDate = enrolled?.dueDate;

        return {
          id: g.id,
          selected: false,
          obligatory: Boolean(isMandatory),
          deadline: typeof dueDate === "string" ? dueDate : "",
        };
      }) ?? [];

    form.reset({ groups: list });
  }, [groups, enrolledGroups, form]);

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
