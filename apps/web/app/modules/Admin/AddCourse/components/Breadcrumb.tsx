import { useNavigate } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";

const Breadcrumb = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink className="body-base-md cursor-pointer text-primary-800">
          <Button
            variant="outline"
            onClick={() => navigate("/admin/courses")}
            className="mr-2 w-min"
          >
            <Icon name="ChevronLeft" className="mr-2 size-3" />
            {t("adminCourseView.settings.breadcrumbs.back")}
          </Button>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbItem>
        <BreadcrumbLink className="text-neutral-850 body-base-md hover:text-neutral-850">
          {t("adminCourseView.settings.breadcrumbs.myCourses")}
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem className="body-base-md text-neutral-950">
        {t("adminCourseView.settings.breadcrumbs.createNew")}
      </BreadcrumbItem>
    </BreadcrumbList>
  );
};

export default Breadcrumb;
