import { Dot } from "lucide-react";

import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

type CategoryChipProps = {
  category: string | ReactNode;
  color?: string;
  className?: string;
  textClassName?: string;
};

export const CategoryChip = ({
  category,
  color = "text-primary-700",
  className,
  textClassName,
}: CategoryChipProps) => {
  const dotClasses = cn("flex-shrink-0", color);

  return (
    <div
      className={cn("flex max-w-fit items-center gap-2 rounded-lg bg-white px-2 py-1", className)}
    >
      <Dot size={8} strokeWidth={4} className={dotClasses} absoluteStrokeWidth />
      <p className={cn("truncate details-md text-primary-950 font-semibold", textClassName)}>
        {category}
      </p>
    </div>
  );
};
