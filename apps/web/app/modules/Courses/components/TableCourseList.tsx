import { Link } from "@remix-run/react";
import { useTranslation } from "react-i18next";

import CardPlaceholder from "~/assets/placeholders/card-placeholder.jpg";
import { CategoryChip } from "~/components/ui/CategoryChip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useUserRole } from "~/hooks/useUserRole";

import CourseCardButton from "./CourseCardButton";

import type { GetAvailableCoursesResponse } from "~/api/generated-api";

type CardCourseListProps = {
  availableCourses?: GetAvailableCoursesResponse["data"];
};

export const TableCourseList = ({ availableCourses }: CardCourseListProps) => {
  const { isAdmin } = useUserRole();
  const { t } = useTranslation();
  return (
    <Table className="w-full">
      <TableHeader>
        <TableRow className="border-none bg-neutral-50">
          <TableHead className="w-24 rounded-s-lg text-sm font-medium text-neutral-950">
            {t("studentCoursesView.availableCourses.headerOptions.image")}
          </TableHead>
          <TableHead className="text-sm font-medium text-neutral-950">
            {t("studentCoursesView.availableCourses.headerOptions.title")}
          </TableHead>
          <TableHead className="hidden text-sm font-medium text-neutral-950 md:table-cell">
            {t("studentCoursesView.availableCourses.headerOptions.category")}
          </TableHead>
          <TableHead className="hidden text-sm font-medium text-neutral-950 lg:table-cell">
            {t("studentCoursesView.availableCourses.headerOptions.description")}
          </TableHead>
          <TableHead className="w-28 rounded-e-lg"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="before:block before:h-4 before:content-['']">
        {availableCourses?.map(
          (
            {
              currency,
              id,
              title,
              thumbnailUrl,
              description,
              category,
              enrolled = false,
              priceInCents,
            },
            index,
          ) => (
            <TableRow
              id={index === 0 ? "available-courses" : undefined}
              key={id}
              className="group border-none hover:bg-primary-50"
            >
              <TableCell className="rounded-s-lg p-4">
                <img
                  src={thumbnailUrl || "https://placehold.co/600x400/png"}
                  alt={title}
                  loading="eager"
                  decoding="async"
                  className="h-12 w-16 rounded-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = CardPlaceholder;
                  }}
                />
              </TableCell>
              <TableCell className="p-4 font-medium">{title}</TableCell>
              <TableCell className="hidden p-4 md:table-cell">
                <CategoryChip
                  category={category}
                  className="bg-primary-50 group-hover:bg-white"
                  color="text-primary-950"
                />
              </TableCell>
              <TableCell className="hidden max-w-xs truncate p-4 lg:table-cell">
                {description}
              </TableCell>
              <TableCell className="rounded-e-lg p-4">
                <Link to={`/course/${id}`} className="block w-full">
                  <CourseCardButton
                    enrolled={enrolled}
                    isAdmin={isAdmin}
                    priceInCents={priceInCents}
                    currency={currency}
                  />
                </Link>
              </TableCell>
            </TableRow>
          ),
        )}
      </TableBody>
    </Table>
  );
};
