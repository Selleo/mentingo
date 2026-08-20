import { Link } from "@remix-run/react";
import { FileSlidersIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { FeaturedCourseSelect } from "./FeaturedCourseSelect";

const CoursesHeader = () => {
  const { t } = useTranslation();

  return (
    <header className="sticky top-6 z-[40] -mb-20 w-full px-6">
      <div className="mx-auto flex w-full max-w-[96rem] flex-wrap items-center gap-2 rounded-2xl border border-neutral-200/80 bg-white/90 p-2 shadow-[0_8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:gap-3 sm:p-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-neutral-50/80 px-2 py-1.5 sm:flex-none sm:pr-3">
          <FeaturedCourseSelect className="min-w-0 flex-1 sm:flex-none" />
        </div>
        <div className="ml-auto flex w-full gap-2 sm:w-auto sm:gap-3">
          <Link to="/admin/courses" className="min-w-0 flex-1 sm:flex-none">
            <Button variant="outline" className="w-full whitespace-nowrap bg-white">
              <FileSlidersIcon className="mr-1 size-5" />
              {t("adminCoursesView.courses.header")}
            </Button>
          </Link>
          <Link to="/admin/beta-courses/new" className="min-w-0 flex-1 sm:flex-none">
            <Button className="w-full whitespace-nowrap shadow-sm">
              <PlusIcon className="mr-1 size-5" />
              {t("adminCourseView.settings.header")}
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default CoursesHeader;
