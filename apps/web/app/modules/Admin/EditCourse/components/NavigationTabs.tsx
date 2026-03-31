import * as Tabs from "@radix-ui/react-tabs";
import { useTranslation } from "react-i18next";

import { EDIT_COURSE_TABS, type NavigationTab } from "../EditCourse.types";

type NavigationTabsProps = {
  setNavigationTabState: (navigationTabState: NavigationTab) => void;
};

const TabTrigger = ({ value, children }: { value: string; children: React.ReactNode }) => (
  <Tabs.Trigger
    className="px-4 py-2 text-lg text-gray-700 hover:text-black data-[state=active]:border-none data-[state=active]:text-primary-800"
    value={value}
  >
    {children}
  </Tabs.Trigger>
);

const NavigationTabs = ({ setNavigationTabState }: NavigationTabsProps) => {
  const { t } = useTranslation();
  const handleValueChange = (value: string) => {
    setNavigationTabState(value as NavigationTab);
  };

  return (
    <Tabs.Root
      className="flex flex-col"
      defaultValue={EDIT_COURSE_TABS.CURRICULUM}
      onValueChange={handleValueChange}
    >
      <Tabs.List className="flex items-center gap-5 border-b border-gray-200">
        <TabTrigger value={EDIT_COURSE_TABS.SETTINGS}>
          {t("adminCourseView.common.settings")}
        </TabTrigger>
        <TabTrigger value={EDIT_COURSE_TABS.CURRICULUM}>
          {t("adminCourseView.common.curriculum")}
        </TabTrigger>
        <TabTrigger value={EDIT_COURSE_TABS.PRICING}>
          {t("adminCourseView.common.pricing")}
        </TabTrigger>
        <TabTrigger value={EDIT_COURSE_TABS.STATUS}>
          {t("adminCourseView.common.status")}
        </TabTrigger>
      </Tabs.List>
    </Tabs.Root>
  );
};

export default NavigationTabs;
