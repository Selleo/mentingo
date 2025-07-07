import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUpdateGroup } from "~/api/mutations/admin/useUpdateGroup";
import { useGroupByIdQuerySuspense } from "~/api/queries/admin/useGroupById";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { groupFormSchema } from "~/modules/Admin/Groups/group.utils";
import Loader from "~/modules/common/Loader/Loader";

import type { ReactElement } from "react";
import type { GroupFormValues } from "~/modules/Admin/Groups/group.utils";

const EditGroup = (): ReactElement => {
  const { id: groupId } = useParams();
  const navigate = useNavigate();

  const { t } = useTranslation();

  const { data, isLoading } = useGroupByIdQuerySuspense(groupId ?? "");
  const { mutateAsync: updateGroupMutation } = useUpdateGroup(groupId ?? "");

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: data.name,
      description: data.description ?? "",
    },
  });

  if (isLoading)
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    );

  if (!data) throw new Error(t("adminGroupsView.updateGroup.groupNotFound"));

  const handleSubmit = async (group: GroupFormValues) => {
    try {
      await updateGroupMutation(group);
      await queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY, { groupId }] });
      navigate("/admin/groups");
    } catch (error) {
      console.error(error);
    }
  };

  const breadcrumbs = [
    { title: t("adminGroupsView.breadcrumbs.groups"), href: "/admin/groups" },
    { title: t("adminGroupsView.breadcrumbs.editGroup"), href: `/admin/groups/${groupId}` },
  ];

  const backButton = { title: t("adminGroupsView.breadcrumbs.back"), href: "/admin/groups" };

  return (
    <PageWrapper breadcrumbs={breadcrumbs} backButton={backButton} isBarebones>
      <div className="flex flex-col gap-y-6">
        <h2 className="mb-4 text-2xl font-semibold text-neutral-950">
          {t("adminGroupsView.updateGroup.header")}
        </h2>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="max-w-md space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="name" className="text">
                    {t("adminGroupsView.updateGroup.fields.name")}
                  </Label>
                  <FormControl>
                    <Input id="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="description" className="text">
                    {t("adminGroupsView.updateGroup.fields.description")}
                  </Label>
                  <FormControl>
                    <Textarea id="description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={!form.formState.isValid || !form.formState.isDirty}>
                {t("adminGroupsView.updateGroup.submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </div>
    </PageWrapper>
  );
};

export default EditGroup;
