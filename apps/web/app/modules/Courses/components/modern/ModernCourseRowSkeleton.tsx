import { Skeleton } from "~/components/ui/skeleton";

type ModernCourseRowSkeletonProps = {
  title?: string;
  courseCount?: number;
};

const ModernCourseRowSkeleton = ({ title, courseCount = 5 }: ModernCourseRowSkeletonProps) => (
  <section className="space-y-4 pb-6">
    {title ? (
      <h2 className="h2 px-4 md:px-8">{title}</h2>
    ) : (
      <Skeleton className="mx-4 h-8 w-48 md:mx-8" />
    )}
    <div className="flex gap-4 overflow-hidden px-4 md:px-8 mt-10">
      {Array.from({ length: courseCount }).map((_, index) => (
        <Skeleton
          key={index}
          className="aspect-video w-[320px] shrink-0 rounded-lg md:w-[380px] lg:w-[400px]"
        />
      ))}
    </div>
  </section>
);

export default ModernCourseRowSkeleton;
