import { Link } from "@remix-run/react";
import { ArrowLeft, Package } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { setPageTitle } from "~/utils/setPageTitle";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createNewCourse");

const ScormCoursePlaceholderPage = () => {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-white px-6 py-8 md:px-10 lg:px-16">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col justify-center">
        <Link
          to="/admin/beta-courses/new"
          className="body-base-md mb-8 inline-flex w-fit items-center gap-2 text-neutral-700 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" />
          {t("adminScorm.coursePlaceholder.back")}
        </Link>

        <div className="rounded-lg border border-neutral-200 bg-white p-8 shadow-sm md:p-10">
          <div className="mb-8 flex size-16 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700">
            <Package className="size-8" aria-hidden="true" />
          </div>
          <p className="body-base-md mb-3 text-emerald-700">
            {t("adminScorm.coursePlaceholder.status")}
          </p>
          <h1 className="h3 text-neutral-950">{t("adminScorm.coursePlaceholder.title")}</h1>
          <p className="body-lg mt-4 max-w-2xl text-neutral-700">
            {t("adminScorm.coursePlaceholder.description")}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="primary">
              <Link to="/admin/beta-courses/new/standard">
                {t("adminScorm.coursePlaceholder.createStandard")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/admin/courses">{t("adminScorm.coursePlaceholder.viewCourses")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ScormCoursePlaceholderPage;
