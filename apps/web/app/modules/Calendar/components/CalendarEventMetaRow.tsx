import type { ReactNode } from "react";

type CalendarEventMetaRowProps = {
  icon: ReactNode;
  label: string;
  value: ReactNode;
};

export function CalendarEventMetaRow({ icon, label, value }: CalendarEventMetaRowProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white px-3 py-2.5">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-neutral-50 text-neutral-600">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-neutral-500">{label}</p>
        <div className="mt-0.5 text-sm text-neutral-900">{value}</div>
      </div>
    </div>
  );
}
