import ArticlesPreferences from "~/modules/Dashboard/Settings/components/admin/ArticlesPreferences";
import { CertificateBackgroundUpload } from "~/modules/Dashboard/Settings/components/admin/CertificateBackgroundUpload";
import NewsPreferences from "~/modules/Dashboard/Settings/components/admin/NewsPreferences";
import { OrganizationLoginBackgroundUpload } from "~/modules/Dashboard/Settings/components/admin/OrganizationLoginBackgroundUpload";
import { OrganizationTheme } from "~/modules/Dashboard/Settings/components/admin/OrganizationTheme";
import AdminPreferences from "~/modules/Dashboard/Settings/components/admin/Preferences";
import QAPreferences from "~/modules/Dashboard/Settings/components/admin/QAPreferences";
import { PlatformLogoForm } from "~/modules/Dashboard/Settings/forms/PlatformLogoForm";
import { PlatformSimpleLogoForm } from "~/modules/Dashboard/Settings/forms/PlatformSimpleLogoForm";

import type { GlobalSettings } from "~/modules/Dashboard/Settings/types";

interface OrganizationTabContentProps {
  isAdmin: boolean;
  globalSettings: GlobalSettings;
}

export default function CustomizePlatformTabContent({
  globalSettings,
}: OrganizationTabContentProps) {
  return (
    <>
      <AdminPreferences globalSettings={globalSettings} />
      <QAPreferences globalSettings={globalSettings} />
      <NewsPreferences globalSettings={globalSettings} />
      <ArticlesPreferences globalSettings={globalSettings} />
      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
        <CertificateBackgroundUpload
          certificateBackgroundImage={globalSettings.certificateBackgroundImage}
          platformLogo={globalSettings.platformLogoS3Key}
        />
        <OrganizationLoginBackgroundUpload
          backgroundImage={globalSettings.loginBackgroundImageS3Key}
        />
        <PlatformLogoForm />
        <PlatformSimpleLogoForm />
      </div>
      <OrganizationTheme />
    </>
  );
}
