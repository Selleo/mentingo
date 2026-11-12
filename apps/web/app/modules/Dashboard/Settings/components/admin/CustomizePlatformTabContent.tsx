import { BrandingImagesCard } from "~/modules/Dashboard/Settings/components/admin/BrandingImagesCard";
import { CertificateBackgroundUpload } from "~/modules/Dashboard/Settings/components/admin/CertificateBackgroundUpload";
import { OrganizationLoginBackgroundUpload } from "~/modules/Dashboard/Settings/components/admin/OrganizationLoginBackgroundUpload";
import { OrganizationTheme } from "~/modules/Dashboard/Settings/components/admin/OrganizationTheme";
import AdminPreferences from "~/modules/Dashboard/Settings/components/admin/Preferences";
import { RegistrationFormBuilder } from "~/modules/Dashboard/Settings/components/admin/RegistrationFormBuilder";
import { PlatformLogoForm } from "~/modules/Dashboard/Settings/forms/PlatformLogoForm";
import { PlatformSimpleLogoForm } from "~/modules/Dashboard/Settings/forms/PlatformSimpleLogoForm";

import type { GlobalSettings } from "~/modules/Dashboard/Settings/types";

interface OrganizationTabContentProps {
  canManageUsers: boolean;
  globalSettings: GlobalSettings;
}

export default function CustomizePlatformTabContent({
  canManageUsers,
  globalSettings,
}: OrganizationTabContentProps) {
  return (
    <>
      <AdminPreferences globalSettings={globalSettings} />
      {canManageUsers && <RegistrationFormBuilder />}
      <BrandingImagesCard>
        <CertificateBackgroundUpload
          certificateBackgroundImage={globalSettings.certificateBackgroundImage}
          platformLogo={globalSettings.platformLogoS3Key}
        />
        <OrganizationLoginBackgroundUpload
          backgroundImage={globalSettings.loginBackgroundImageS3Key}
        />
        <PlatformLogoForm />
        <PlatformSimpleLogoForm />
      </BrandingImagesCard>
      <OrganizationTheme />
    </>
  );
}
