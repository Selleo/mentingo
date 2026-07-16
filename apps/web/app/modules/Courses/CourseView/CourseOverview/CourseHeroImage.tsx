import type { ReactNode } from "react";

type CourseHeroImageProps = {
  alt: string;
  children?: ReactNode;
  imagePosition?: number;
  imageUrl: string;
};

export default function CourseHeroImage({
  alt,
  children,
  imagePosition = 50,
  imageUrl,
}: CourseHeroImageProps) {
  return (
    <div className="group relative aspect-[4/3] md:aspect-[21/9]">
      <img
        src={imageUrl}
        style={{ objectPosition: `center ${imagePosition}%` }}
        alt={alt}
        className="size-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.7)] via-[rgba(0,0,0,0.2)] to-[rgba(0,0,0,0.1)]" />

      {children}
    </div>
  );
}
