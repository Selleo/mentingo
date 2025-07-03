import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";

import ChangePasswordForm from "./forms/ChangePasswordForm";
import UserDetailsForm from "./forms/UserDetailsForm";
import UserForm from "./forms/UserForm";
import { SettingsPageBreadcrumbs } from "./SettingsPageBreadcrumbs";

export default function SettingsPage() {
  const { isTeacher, isAdmin } = useUserRole();

  return (
    <PageWrapper className="flex flex-col gap-6 *:h-min">
      <SettingsPageBreadcrumbs />
      <UserForm />
      {(isTeacher || isAdmin) && <UserDetailsForm />}
      <ChangePasswordForm />
    </PageWrapper>
  );
}
