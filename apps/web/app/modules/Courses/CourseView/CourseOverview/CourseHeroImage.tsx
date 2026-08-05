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
    <div className="group relative grid min-h-[32rem] w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)] aspect-[4/3] overflow-hidden min-[360px]:min-h-[30rem] sm:min-h-0 md:aspect-[21/9]">
      <img
        src={imageUrl}
        style={{ objectPosition: `center ${imagePosition}%` }}
        alt={alt}
        className="absolute inset-0 size-full object-cover"
      />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.7)] via-[rgba(0,0,0,0.2)] to-[rgba(0,0,0,0.1)]" />

      {children}
    </div>
  );
}
