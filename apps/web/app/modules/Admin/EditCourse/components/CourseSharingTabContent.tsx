import { NativeArchiveExportCard } from "~/modules/Admin/components/NativeArchiveExportCard";

import { ScormExportCard } from "./ScormExportCard";
import { SharedCourseExportsTabContent } from "./SharedCourseExportsTabContent";

import type { SupportedLanguages } from "@repo/shared";

type CourseSharingTabContentProps = {
  courseId: string;
  language: SupportedLanguages;
  unsupportedLessonCount: number;
  showTenantSharing: boolean;
};

export const CourseSharingTabContent = ({
  courseId,
  language,
  unsupportedLessonCount,
  showTenantSharing,
}: CourseSharingTabContentProps) => {
  return (
    <div className="flex w-full max-w-[1040px] flex-col gap-5">
      <ScormExportCard
        courseId={courseId}
        language={language}
        unsupportedLessonCount={unsupportedLessonCount}
      />
      <NativeArchiveExportCard kind="course" id={courseId} />
      {showTenantSharing && <SharedCourseExportsTabContent courseId={courseId} />}
    </div>
  );
};
