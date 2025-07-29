import CoursesAccessibilityPreferences from "./CoursesAccessibilityPreferences";

import type { GlobalSettings } from "../../types";

interface GlobalPreferencesProps {
  globalSettings: GlobalSettings;
}

export function GlobalPreferences({ globalSettings }: GlobalPreferencesProps) {
  return <CoursesAccessibilityPreferences globalSettings={globalSettings} />;
}
