import { useTranslation } from "react-i18next";

import SplashScreenImage from "~/assets/svgs/splash-screen-image.svg";
import { setPageTitle } from "~/utils/setPageTitle";

import Breadcrumb from "./components/Breadcrumb";
import { NativeArchiveImport } from "./components/NativeArchiveImport";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createNewCourse");

export default function NativeArchiveImportPage() {
  const { t } = useTranslation();

  return (
    <main className="flex h-screen overflow-auto bg-white px-20 py-8">
      <div className="flex w-full items-center justify-center">
        <img src={SplashScreenImage} alt="" className="rounded" />
      </div>
      <div className="flex w-full max-w-[820px] flex-col justify-center gap-y-6 px-8">
        <Breadcrumb
          backTo="/admin/beta-courses/new"
          currentLabel={t("adminCourseTypeSelector.mentingoPackage.title")}
        />
        <hgroup className="flex flex-col gap-1">
          <h1 className="h3 text-neutral-950">{t("nativeArchive.importTitle")}</h1>
        </hgroup>
        <NativeArchiveImport cancelTo="/admin/beta-courses/new" />
      </div>
    </main>
  );
}
