import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateGroup } from "~/api/mutations/admin/useCreateGroup";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import CreateGroupCard from "~/modules/Admin/Groups/components/CreateGroupCard";
import { GroupPageBreadcrumbs } from "~/modules/Admin/Groups/components/GroupBreadcrumbs";
import { GroupHeader } from "~/modules/Admin/Groups/components/GroupHeader";
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
      characteristic: "",
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

  return (
    <PageWrapper className="flex h-full flex-col">
      <GroupPageBreadcrumbs name={t("adminGroupsView.newGroup.header")} href="" />
      <GroupHeader
        title={t("adminGroupsView.newGroup.header")}
        handlePublish={() => form.handleSubmit(handleSubmit)()}
        handleCancel={() => navigate("/admin/groups")}
      />
      <CreateGroupCard form={form} handleSubmit={handleSubmit} />
    </PageWrapper>
  );
};

export default CreateGroup;
