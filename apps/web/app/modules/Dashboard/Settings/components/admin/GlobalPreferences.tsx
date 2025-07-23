import CoursesAccessibilityPreferences from "./CoursesAccessibilityPreferences";

import type { GlobalSettings } from "~/api/generated-api";

interface GlobalPreferencesProps {
  globalSettings: GlobalSettings;
}

export function GlobalPreferences({ globalSettings }: GlobalPreferencesProps) {
  return (
    <>
      <CoursesAccessibilityPreferences globalSettings={globalSettings} />
    </>
  );
}
