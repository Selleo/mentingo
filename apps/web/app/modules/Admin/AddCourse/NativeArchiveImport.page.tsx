import { Link } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import SplashScreenImage from "~/assets/svgs/splash-screen-image.svg";
import { Button } from "~/components/ui/button";
import { setPageTitle } from "~/utils/setPageTitle";

import Breadcrumb from "./components/Breadcrumb";
import { NativeArchiveImport } from "./components/NativeArchiveImport";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createNewCourse");

export default function NativeArchiveImportPage() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-white px-6 py-8 lg:grid lg:grid-cols-2 lg:gap-12 lg:px-16">
      <div className="hidden items-center justify-center lg:flex">
        <img src={SplashScreenImage} alt="" className="w-full max-w-xl rounded" />
      </div>
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 lg:justify-center">
        <Breadcrumb
          backTo="/admin/beta-courses/new"
          currentLabel={t("adminCourseTypeSelector.mentingoPackage.title")}
        />
        <hgroup className="flex flex-col gap-1">
          <p className="body-base-md text-sky-700">{t("adminCourseTypeSelector.eyebrow")}</p>
          <h1 className="h3 text-neutral-950">{t("nativeArchive.importTitle")}</h1>
        </hgroup>
        <NativeArchiveImport />
        <div>
          <Button asChild type="button" variant="outline">
            <Link to="/admin/beta-courses/new">{t("common.button.cancel")}</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
