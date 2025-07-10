import { PageWrapper } from "~/components/PageWrapper";
import { useUserRole } from "~/hooks/useUserRole";

import LanguageSelect from "./components/LanguageSelect";
import ChangePasswordForm from "./forms/ChangePasswordForm";
import UserDetailsForm from "./forms/UserDetailsForm";
import UserForm from "./forms/UserForm";

export default function SettingsPage() {
  const { isContentCreator, isAdmin } = useUserRole();

  return (
    <PageWrapper className="flex flex-col gap-6 *:h-min">
      <LanguageSelect />
      <UserForm />
      {(isContentCreator || isAdmin) && <UserDetailsForm />}
      <ChangePasswordForm />
    </PageWrapper>
  );
}
