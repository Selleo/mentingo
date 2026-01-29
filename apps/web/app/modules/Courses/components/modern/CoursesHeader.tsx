import { Link } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { MobileNavigationDropdown } from "~/modules/Dashboard/components";

const navigationLinks = [
  {
    to: "/admin/courses",
    label: "Manage Courses",
  },
  {
    to: "/admin/beta-courses/new",
    label: "Create new course",
  },
];

const CoursesHeader = () => {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-10 w-full">
      <div className="flex w-full items-center justify-end px-4 py-3">
        <div className="flex items-center gap-3">
          <MobileNavigationDropdown
            links={navigationLinks}
            menuLabel={t("navigationSideBar.menu")}
            closeLabel={t("navigationSideBar.close")}
            withAuthButtons={false}
          />
          <div className="hidden items-center gap-3 md:flex">
            <Link to="/admin/courses">
              <Button variant="outline" className="w-full">
                Manage Courses
              </Button>
            </Link>
            <Link to="/admin/beta-courses/new">
              <Button className="w-full">Create new course</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};

export default CoursesHeader;
