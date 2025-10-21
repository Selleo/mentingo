interface CourseAdminStatisticsCardProps {
  title: string;
  statistic: number;
  type?: "number" | "percentage";
}

export function CourseAdminStatisticsCard({
  title,
  statistic,
  type,
}: CourseAdminStatisticsCardProps) {
  return (
    <div className="rounded-sm p-6 outline outline-1 outline-neutral-200 flex flex-col justify-center">
      <p className="body-sm-md">{title}</p>
      <p className="h5">{type === "percentage" ? `${statistic}%` : statistic}</p>
    </div>
  );
}
