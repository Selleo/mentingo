import { Link } from "@remix-run/react";
import { Cell, Label, Pie, PieChart, ResponsiveContainer } from "recharts";

import { Button } from "~/components/ui/button";

type TrainingStatus = {
  status: string;
  value: number;
  color: string;
};

type TrainingCompletionWidgetProps = {
  data?: TrainingStatus[];
};

const MOCK_STATUS_DATA: TrainingStatus[] = [
  {
    status: "Ukończone",
    value: 42,
    color: "var(--success-600)",
  },
  {
    status: "W trakcie",
    value: 18,
    color: "var(--warning-500)",
  },
  {
    status: "Nierozpoczęte",
    value: 12,
    color: "var(--neutral-300)",
  },
];

export default function TrainingCompletionWidget({
  data = MOCK_STATUS_DATA,
}: TrainingCompletionWidgetProps) {
  const completedEnrollments = data.find(({ status }) => status === "Ukończone")?.value ?? 0;

  const totalEnrollments = data.reduce((total, item) => total + item.value, 0);

  const completionPercentage =
    totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

  if (totalEnrollments === 0) {
    return (
      <article className="flex h-full min-h-80 flex-col rounded-md bg-white px-4 py-2">
        <h2 className="body-lg-md text-neutral-950">Realizacja szkoleń</h2>

        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <p className="text-sm text-neutral-700">Nie ma jeszcze żadnych przypisań do kursów.</p>

          <Button asChild>
            <Link to="/admin/courses">Przypisz kursy</Link>
          </Button>
        </div>
      </article>
    );
  }

  return (
    <article className="flex h-full min-h-80 flex-col rounded-md bg-white px-4 py-2">
      <div>
        <h2 className="body-lg-md text-neutral-950">Realizacja szkoleń</h2>

        <p className="mt-1 text-sm text-neutral-700">Status wszystkich przypisań do kursów</p>
      </div>

      <div className="mt-4 grid flex-1 grid-cols-[minmax(0,1fr)_minmax(140px,0.9fr)] items-center gap-4">
        <div className="h-44 min-w-0" aria-label={`Ukończono ${completionPercentage}% szkoleń`}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="status"
                innerRadius={52}
                outerRadius={76}
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                stroke="transparent"
              >
                {data.map((item) => (
                  <Cell key={item.status} fill={item.color} />
                ))}

                <Label
                  position="center"
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                      return null;
                    }

                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan className="fill-neutral-950 text-2xl font-semibold">
                          {completionPercentage}%
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="flex flex-col gap-3">
          {data.map((item) => (
            <li key={item.status} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-neutral-700">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />

                <span>{item.status}</span>
              </span>

              <span className="font-medium text-neutral-950">{item.value}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-4">
        <p className="text-sm text-neutral-700">
          Ukończone: <span className="font-medium text-neutral-950">{completedEnrollments}</span> /{" "}
          {totalEnrollments}
        </p>

        <Button asChild variant="outline">
          <Link to="/admin/analytics">Zobacz analitykę</Link>
        </Button>
      </div>
    </article>
  );
}
