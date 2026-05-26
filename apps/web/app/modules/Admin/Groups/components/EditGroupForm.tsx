import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUpdateGroup } from "~/api/mutations/admin/useUpdateGroup";
import CreateGroupCard from "~/modules/Admin/Groups/components/CreateGroupCard";
import { GroupHeader } from "~/modules/Admin/Groups/components/GroupHeader";
import { groupFormSchema } from "~/modules/Admin/Groups/group.utils";

import { GROUP_FORM_HANDLES, GROUP_PAGE_HANDLES } from "../../../../../e2e/data/groups/handles";

import type { SupportedLanguages } from "@repo/shared";
import type { ReactElement } from "react";
import type { GetGroupByIdResponse } from "~/api/generated-api";
import type { GroupFormValues } from "~/modules/Admin/Groups/group.utils";

type EditGroupFormProps = {
  formKey: string;
  group: GetGroupByIdResponse["data"];
  groupId: string;
  language: SupportedLanguages;
  languageSelector: ReactElement;
};

export const EditGroupForm = ({
  formKey,
  group,
  groupId,
  language,
  languageSelector,
}: EditGroupFormProps): ReactElement => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mutateAsync: updateGroupMutation } = useUpdateGroup(groupId);

  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
      name: group.name,
      characteristic: group.characteristic ?? "",
      language,
    },
  });

  const handleSubmit = async (groupValues: GroupFormValues) => {
    await updateGroupMutation(groupValues);
  };

  return (
    <>
      <GroupHeader
        title={t("adminGroupsView.updateGroup.header")}
        handlePublish={() => form.handleSubmit(handleSubmit)()}
        handleCancel={() => navigate("/admin/groups")}
        headingTestId={GROUP_PAGE_HANDLES.HEADING}
        cancelButtonTestId={GROUP_FORM_HANDLES.CANCEL_BUTTON}
        submitButtonTestId={GROUP_FORM_HANDLES.SUBMIT_BUTTON}
      />
      <CreateGroupCard
        key={formKey}
        form={form}
        handleSubmit={handleSubmit}
        languageSelector={languageSelector}
      />
    </>
  );
};
