import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateGroup } from "~/api/mutations/admin/useCreateGroup";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { CreatePageHeader } from "~/modules/Admin/components";
import { groupFormSchema } from "~/modules/Admin/Groups/group.utils";

import type { ReactElement } from "react";
import type { GroupFormValues } from "~/modules/Admin/Groups/group.utils";

const CreateGroup = (): ReactElement => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutateAsync: createGroupMutation } = useCreateGroup();

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const handleSubmit = async (group: GroupFormValues) => {
    try {
      await createGroupMutation(group);
      await queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });
      navigate("/admin/groups");
    } catch (error) {
      console.error(error);
    }
  };

  const breadcrumbs = [
    { title: t("adminGroupsView.breadcrumbs.groups"), href: "/admin/groups" },
    { title: t("adminGroupsView.breadcrumbs.createNew"), href: "/admin/groups/new" },
  ];

  const backButton = { title: t("adminGroupsView.breadcrumbs.back"), href: "/admin/groups" };

  return (
    <PageWrapper breadcrumbs={breadcrumbs} backButton={backButton}>
      <div className="flex flex-col gap-y-6">
        <CreatePageHeader
          title={t("adminGroupsView.newGroup.header")}
          description={t("adminGroupsView.newGroup.subheader")}
        />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="max-w-md space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="name" className="text">
                    {t("adminGroupsView.newGroup.fields.name")}
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
                    {t("adminGroupsView.newGroup.fields.description")}
                  </Label>
                  <FormControl>
                    <Textarea id="description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={!form.formState.isValid}>
                {t("adminGroupsView.newGroup.submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </div>
    </PageWrapper>
  );
};

export default CreateGroup;
