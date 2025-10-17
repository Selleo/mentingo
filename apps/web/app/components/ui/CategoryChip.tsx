import { Dot } from "lucide-react";

import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

type CategoryChipProps = {
  category: string | ReactNode;
  color?: string;
  className?: string;
};

export const CategoryChip = ({
  category,
  color = "text-primary-700",
  className,
}: CategoryChipProps) => {
  const dotClasses = cn("flex-shrink-0", color);

  return (
    <div
      className={cn("flex max-w-fit items-center gap-2 rounded-lg bg-white px-2 py-1", className)}
    >
      <Dot size={8} strokeWidth={4} className={dotClasses} absoluteStrokeWidth />
      <div className="truncate details-md text-primary-950">{category}</div>
    </div>
  );
};
