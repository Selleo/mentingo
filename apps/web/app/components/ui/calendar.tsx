// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck - react-day-picker untyped library
import { format, getDate } from "date-fns";
import { DayPicker } from "react-day-picker";

import { Checkmark } from "~/assets/svgs";
import { buttonVariants } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { ComponentProps } from "react";
import type { DayProps } from "react-day-picker";

export type CalendarProps = ComponentProps<typeof DayPicker> & {
  dates: string[] | undefined;
};
type CustomDayContentProps = DayProps & {
  "data-day": string;
  dates: string[] | undefined;
  day: { outside: boolean | undefined };
  children: { props: { children: string } };
};
function CustomDayContent({ dates, ...props }: CustomDayContentProps) {
  const formattedDate = format(props.date, "yyyy-MM-dd");
  const day = getDate(props.date);
  if (dates?.includes(formattedDate)) {
    const classes = cn(
      "text-primary-foreground hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground p-0 border aspect-square size-8 text-sm flex items-center justify-center has-[button]:hover:!bg-success-200 rounded-full has-[button]:hover:aria-selected:!bg-success-500 has-[button]:hover:text-accent-foreground has-[button]:hover:aria-selected:text-primary-foreground",
      { "bg-success-200 border-success-200": !!props?.activeModifiers?.outside },
      { "bg-success-500 border-success-500": !props?.activeModifiers?.outside },
    );
    return (
      <td className={classes}>
        <Checkmark className="size-6 text-white" />
      </td>
    );
  }
  const classes2 = cn(
    "p-0 border border-neutral-300 text-neutral-950 aspect-square size-8 text-sm flex items-center justify-center has-[button]:hover:!bg-success-200 rounded-full has-[button]:hover:aria-selected:!bg-success-500 has-[button]:hover:text-accent-foreground has-[button]:hover:aria-selected:text-primary-foreground",
    { "bg-neutral-100": !!props?.activeModifiers?.outside },
  );
  return <td className={classes2}>{day}</td>;
}
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  dates,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("w-min max-w-[320px] md:w-full", className)}
      classNames={{
        table: "flex flex-col items-center",
        cell: "p-0",
        head_row: "flex justify-center w-full pt-3 pb-2 flex-row gap-1.5 lg:gap-2",
        head_cell: "w-8 text-center details-md text-neutral-950",
        row: "flex justify-center flex-row gap-1.5 lg:gap-2",
        tbody: "flex flex-col relative gap-1.5 lg:gap-3",
        months: "flex flex-col relative",
        month_caption:
          "flex justify-center h-10 w-full border-primary-500 border-b relative items-center",
        weekdays: "flex justify-center flex-row gap-1.5 lg:gap-2",
        weekday: "text-muted-foreground w-8 font-normal text-[0.8rem]",
        month:
          "gap-y-4 overflow-x-hidden w-full border border-primary-500 rounded-2xl pt-1.5 pb-4 lg:pb-6 px-2.5 lg:px-6",
        caption: "border-primary-500 border-b h-10 flex justify-center pt-1 relative items-center",
        caption_label: "truncate body-lg-md",
        button_next: cn(
          buttonVariants({
            variant: "outline",
            className: "absolute right-0 size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          }),
        ),
        button_previous: cn(
          buttonVariants({
            variant: "outline",
            className: "absolute left-0 size-7 bg-transparent p-0 opacity-50 hover:opacity-100",
          }),
        ),
        nav: "flex items-start justify-between absolute w-full",
        month_grid: "mt-4 w-full",
        week: "flex w-full mt-3 justify-center gap-1.5 lg:gap-2",
        day: "p-0 border border-neutral-300 text-neutral-950 aspect-square size-8 text-sm flex items-center justify-center has-[button]:hover:!bg-success-200 rounded-full has-[button]:hover:aria-selected:!bg-success-500 has-[button]:hover:text-accent-foreground has-[button]:hover:aria-selected:text-primary-foreground",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal transition-none hover:bg-transparent hover:text-inherit aria-selected:opacity-100",
        ),
        range_start: "day-range-start rounded-s-md",
        range_end: "day-range-end rounded-e-md",
        selected:
          "bg-success-500 border-success-500 text-primary-foreground hover:!bg-success-200 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside:
          "day-outside border-success-200 text-white bg-success-200 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent hover:aria-selected:!bg-accent rounded-none aria-selected:text-accent-foreground hover:aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        DayContent: ({ ...props }) => {
          return <CustomDayContent dates={dates} {...props} />;
        },
        IconLeft: () => <div className="sr-only" />,
        IconRight: () => <div className="sr-only" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";
export { Calendar };
