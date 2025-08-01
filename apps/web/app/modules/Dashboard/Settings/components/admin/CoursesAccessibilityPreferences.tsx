import { useTranslation } from "react-i18next";

import { useUnregisteredUserCoursesAccessibility } from "~/api/mutations/admin/useUnregisteredUserCoursesAccessibility";
import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

import { SettingItem } from "../SettingItem";

import type { GlobalSettings } from "../../types";

interface CoursesAccessibilityPreferencesProps {
  globalSettings: GlobalSettings;
}

export default function CoursesAccessibilityPreferences({
  globalSettings,
}: CoursesAccessibilityPreferencesProps) {
  const { t } = useTranslation();

  const { mutate: changeUnregisteredUserCoursesAccessibility } =
    useUnregisteredUserCoursesAccessibility();

  const handleCoursesAccessibilityChange = () => {
    changeUnregisteredUserCoursesAccessibility();
  };

  return (
    <Card id="admin-courses-accessibility-preferences">
      <CardHeader>
        <CardTitle>{t("adminPreferences.courseSettings")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <SettingItem
            id="coursesVisibility"
            label={t("adminPreferences.field.coursesVisibility")}
            description={t("adminPreferences.field.coursesVisibilityDescription")}
            checked={globalSettings.unregisteredUserCoursesAccessibility}
            onCheckedChange={handleCoursesAccessibilityChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
