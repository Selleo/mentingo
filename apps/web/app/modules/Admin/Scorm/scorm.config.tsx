import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCategoriesSuspense } from "~/api/queries";
import { Icon } from "~/components/Icon";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";
import CourseCard from "~/modules/Dashboard/Courses/CourseCard";

import { CourseDetailsStep } from "./components/CourseDetailsStep";
import { PricingStep } from "./components/PricingStep";
import { ScormUploadStep } from "./components/ScormUploadStep";
import { StatusStep } from "./components/StatusStep";
import { useScormFormStore } from "./store/scormForm.store";

import type { CourseCardProps } from "~/modules/Dashboard/Courses/CourseCard";

type SideComponentProps =
  | {
      className?: string;
    }
  | (CourseCardProps & { className?: string });

export const SCORM_CONFIG = [
  {
    id: "upload",
    title: "adminScorm.header",
    description: "adminScorm.subHeader",
    Component: ScormUploadStep,
    SideComponent: ({ className }: SideComponentProps) => (
      <Icon name="UploadIllustration" className={className} />
    ),
  },
  {
    id: "details",
    title: "adminScorm.other.setUpCourse",
    description: "adminScorm.other.provideDetails",
    Component: CourseDetailsStep,
    SideComponent: (props: SideComponentProps) => {
      const { data: categories } = useCategoriesSuspense();

      const { currentUser: { email, firstName, lastName, profilePictureUrl } = {} } =
        useCurrentUserStore.getState();
      const {
        formData: { details: { title, description, category: categoryId, thumbnail } = {} },
      } = useScormFormStore.getState();

      const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
      const { t } = useTranslation();

      useEffect(() => {
        if (thumbnail) {
          const url = URL.createObjectURL(thumbnail);
          setThumbnailUrl(url);
          return () => URL.revokeObjectURL(url);
        }
      }, [thumbnail]);

      const categoryName = categories.find((category) => category.id === categoryId)?.title;

      return (
        <CourseCard
          id={"scorm-card"}
          title={title || t("adminScorm.other.untitled")}
          thumbnailUrl={thumbnailUrl ?? ""}
          description={description || t("adminScorm.other.noDescription")}
          author={`${firstName} ${lastName}`}
          authorEmail={email ?? ""}
          authorAvatarUrl={profilePictureUrl ?? ""}
          category={categoryName ?? ""}
          courseChapterCount={0}
          completedChapterCount={0}
          enrolledParticipantCount={0}
          priceInCents={0}
          currency={""}
          dueDate={null}
          {...props}
        />
      );
    },
  },
  {
    id: "pricing",
    title: "adminScorm.other.pricing",
    description: "adminScorm.other.setUpPricing",
    Component: PricingStep,
    SideComponent: ({ className }: SideComponentProps) => (
      <Icon name="PricingIllustration" className={className} />
    ),
  },
  {
    id: "status",
    title: "adminScorm.other.status",
    description: "adminScorm.other.setUpStatus",
    Component: StatusStep,
    SideComponent: ({ className }: SideComponentProps) => (
      <Icon name="StatusIllustration" className={className} />
    ),
  },
] as const;
