import { Info } from "~/assets/svgs";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

interface CourseAdminStatisticsCardProps {
  title: string;
  statistic: number;
  tooltipText: string;
  type?: "number" | "percentage";
}

export function CourseAdminStatisticsCard({
  title,
  statistic,
  tooltipText,
  type,
}: CourseAdminStatisticsCardProps) {
  return (
    <div className="rounded-sm p-6 outline outline-1 outline-neutral-200 flex flex-col justify-center">
      <div className="flex items-center gap-2">
        <p className="body-sm-md">{title}</p>
        <Tooltip>
          <TooltipTrigger>
            <Info className="size-4 cursor-pointer" />
          </TooltipTrigger>
          <TooltipContent>
            <p className="body-sm-md">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="h5">{type === "percentage" ? `${statistic}%` : statistic}</p>
    </div>
  );
}
