import { useTranslation } from "react-i18next";

import DefaultCoursePhoto from "~/assets/svgs/default-photo-course.svg";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { UserProfile } from "~/components/UserProfile/UserProfile";

type CourseCardPreviewProps = {
  imageUrl?: string;
  title?: string;
  category?: string;
  description?: string;
};

const CourseCardPreview = ({ imageUrl, title, description, category }: CourseCardPreviewProps) => {
  const { t } = useTranslation();

  return (
    <Card className="w-3/10 border border-gray-200 p-6 shadow-md">
      <CardHeader className="relative flex flex-col !gap-y-1">
        <h5 className="h5 text-neutral-950">{t("adminCourseView.settings.sideSection.header")}</h5>
        <p className="body-lg-md text-neutral-800">
          {t("adminCourseView.settings.sideSection.subHeader")}
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Card className="relative mt-4 w-full max-w-xs rounded-lg shadow-md">
            <CardHeader className="overflow-hidden rounded-t-lg p-0">
              <img
                src={imageUrl || DefaultCoursePhoto}
                alt="header"
                className="h-60 w-full object-cover"
              />
              {category && (
                <div className="absolute left-3 top-3 flex items-center space-x-2 rounded-lg bg-white px-4 py-2 text-sm text-black shadow-md">
                  <div className="size-1 rounded-full bg-black"></div>
                  <span>{category}</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex flex-col justify-between p-3">
              <h1 className="break-words text-left font-bold">
                {title || t("adminCourseView.settings.sideSection.other.untitled")}
              </h1>
              <UserProfile />
              <div
                className="description line-clamp-3 break-words text-left text-gray-500"
                dangerouslySetInnerHTML={{
                  __html:
                    description || t("adminCourseView.settings.sideSection.other.noDescription"),
                }}
              />
              <div className="mt-5 flex w-full justify-center">
                <Button className="mx-auto mt-4 w-3/4">
                  {t("adminCourseView.settings.sideSection.button.enroll")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
};

export default CourseCardPreview;
