import { COURSE_HERO_PLACEHOLDER_BACKGROUND } from "./courseHeroPlaceholder";

import type { ReactNode } from "react";

type CourseHeroImageProps = {
  alt: string;
  children?: ReactNode;
  imagePosition?: number;
  imageUrl?: string;
};

export default function CourseHeroImage({
  alt,
  children,
  imagePosition = 50,
  imageUrl,
}: CourseHeroImageProps) {
  return (
    <div className="group relative grid aspect-video min-h-[22rem] w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)] overflow-hidden sm:min-h-0 md:aspect-[21/9]">
      <div
        role="img"
        aria-label={alt}
        style={{
          backgroundImage: COURSE_HERO_PLACEHOLDER_BACKGROUND,
          backgroundPosition: `center ${imagePosition}%`,
        }}
        className="absolute inset-0 size-full bg-cover bg-no-repeat"
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            loading="eager"
            className="size-full object-cover"
            style={{ objectPosition: `center ${imagePosition}%` }}
          />
        )}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.7)] via-[rgba(0,0,0,0.2)] to-[rgba(0,0,0,0.1)]" />

      {children}
    </div>
  );
}
