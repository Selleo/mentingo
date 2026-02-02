import { Link } from "@remix-run/react";
import { FileSlidersIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

const CoursesHeader = () => {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 w-full flex justify-end p-1 -mt-16 z-[40] bg-[rgba(255,255,255,0.3)] backdrop-blur">
      <div className="items-center gap-3 flex">
        <Link to="/admin/courses">
          <Button variant="outline" className="w-full">
            <FileSlidersIcon className="mr-1 size-5" />
            {t("adminCoursesView.courses.header")}
          </Button>
        </Link>
        <Link to="/admin/beta-courses/new">
          <Button className="w-full">
            <PlusIcon className="mr-1 size-5" />
            {t("adminCourseView.settings.header")}
          </Button>
        </Link>
      </div>
    </header>
  );
};

export default CoursesHeader;
