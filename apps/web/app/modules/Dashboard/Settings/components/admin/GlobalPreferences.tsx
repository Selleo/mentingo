import PlatformLogoForm from "../../forms/PlatformLogoForm";

import CoursesAccessibilityPreferences from "./CoursesAccessibilityPreferences";

import type { GlobalSettings } from "../../types";

interface GlobalPreferencesProps {
  globalSettings: GlobalSettings;
}

export function GlobalPreferences({ globalSettings }: GlobalPreferencesProps) {
  return (
    <div className="space-y-6">
      <CoursesAccessibilityPreferences globalSettings={globalSettings} />
      <PlatformLogoForm />
    </div>
  );
}
