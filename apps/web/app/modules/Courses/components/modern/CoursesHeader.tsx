import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";

const CoursesHeader = () => {
  return (
    <header className="sticky top-0 w-full flex justify-end p-2 -mt-16 z-[40]">
      <div className="items-center gap-3 flex">
        <Link to="/admin/courses">
          <Button variant="outline" className="w-full">
            Manage Courses
          </Button>
        </Link>
        <Link to="/admin/beta-courses/new">
          <Button className="w-full">Create new course</Button>
        </Link>
      </div>
    </header>
  );
};

export default CoursesHeader;
