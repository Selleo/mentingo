import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUpdateGroup } from "~/api/mutations/admin/useUpdateGroup";
import { useGroupByIdQuerySuspense } from "~/api/queries/admin/useGroupById";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import CreateGroupCard from "~/modules/Admin/Groups/components/CreateGroupCard";
import { GroupHeader } from "~/modules/Admin/Groups/components/GroupHeader";
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
      characteristic: data.characteristic ?? "",
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

  return (
    <PageWrapper
      className="flex h-full flex-col"
      backButton={{ href: "/admin/groups", title: t("adminGroupsView.breadcrumbs.back") }}
      breadcrumbs={[
        {
          title: t("adminGroupsView.breadcrumbs.dashboard"),
          href: "/",
        },
        {
          title: t("adminGroupsView.breadcrumbs.groups"),
          href: "/admin/groups",
        },
        {
          title: t("adminGroupsView.updateGroup.header"),
          href: "/admin/groups/new",
        },
      ]}
    >
      <GroupHeader
        title={t("adminGroupsView.updateGroup.header")}
        handlePublish={() => form.handleSubmit(handleSubmit)()}
        handleCancel={() => navigate("/admin/groups")}
      />
      <CreateGroupCard form={form} handleSubmit={handleSubmit} />
    </PageWrapper>
  );
};

export default EditGroup;
