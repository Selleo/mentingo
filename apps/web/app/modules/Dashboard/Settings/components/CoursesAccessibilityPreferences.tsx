import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card";

import { SettingItem } from "./SettingItem";

import type { UserSettings } from "~/api/generated-api";

interface CoursesAccessibilityPreferencesProps {
  settings: UserSettings;
}

export default function CoursesAccessibilityPreferences({
  settings,
}: CoursesAccessibilityPreferencesProps) {
  const { t } = useTranslation();

  settings;

  const [mockchecked, setMockChecked] = useState(true);

  const changeCoursesAccessibility = () => {
    setMockChecked(!mockchecked);
  };

  const handleCoursesAccessibilityChange = () => {
    changeCoursesAccessibility();
  };

  return (
    <Card id="admin-courses-accessibility-preferences">
      <CardHeader>
        <CardTitle>{t("adminPreferences.courseSettings")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="space-y-4">
            <SettingItem
              id="coursesAccessibility"
              label={t("adminPreferences.field.coursesAccessibility")}
              description={t("adminPreferences.field.coursesAccessibilityDescription")}
              checked={mockchecked}
              onCheckedChange={handleCoursesAccessibilityChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
