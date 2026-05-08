import { format } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { formatHtmlString } from "~/lib/formatters/formatHtmlString";

import type { GetStudentsWithEnrollmentDateResponse } from "~/api/generated-api";

type EnrolledStudent = GetStudentsWithEnrollmentDateResponse["data"][number];

type LearningPathEnrollmentTableProps = {
  users: EnrolledStudent[];
  selectedRows: Record<string, boolean>;
  isPending: boolean;
  allPageSelected: boolean;
  onToggleRow: (userId: string, checked: boolean) => void;
  onToggleAllRows: (checked: boolean) => void;
};

export function LearningPathEnrollmentTable({
  users,
  selectedRows,
  isPending,
  allPageSelected,
  onToggleRow,
  onToggleAllRows,
}: LearningPathEnrollmentTableProps) {
  const { t } = useTranslation();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">
            <Checkbox
              checked={allPageSelected}
              onCheckedChange={(checked) => onToggleAllRows(Boolean(checked))}
              aria-label={t("learningPathsView.enrollment.table.selectAll")}
              disabled={isPending}
            />
          </TableHead>
          <TableHead>{t("learningPathsView.enrollment.table.name")}</TableHead>
          <TableHead>{t("learningPathsView.enrollment.table.email")}</TableHead>
          <TableHead>{t("adminUsersView.field.group")}</TableHead>
          <TableHead>{t("learningPathsView.enrollment.table.status")}</TableHead>
          <TableHead>{t("learningPathsView.enrollment.table.enrollmentDate")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <Checkbox
                checked={Boolean(selectedRows[user.id])}
                onCheckedChange={(checked) => onToggleRow(user.id, Boolean(checked))}
                aria-label={t("learningPathsView.enrollment.table.select")}
                disabled={isPending}
              />
            </TableCell>
            <TableCell>
              {formatHtmlString(user.name ?? `${user.firstName} ${user.lastName}`)}
            </TableCell>
            <TableCell>{formatHtmlString(user.email)}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {user.groups.slice(0, 2).map((group) => (
                  <Badge key={group.id} variant="secondary">
                    {group.name}
                  </Badge>
                ))}
                {user.groups.length > 2 && (
                  <Badge variant="default">+{user.groups.length - 2}</Badge>
                )}
              </div>
            </TableCell>
            <TableCell>
              {user.enrolledAt ? (
                <Badge variant="success" className="w-max gap-1">
                  <CheckCircle2 className="size-3.5" />
                  {user.isEnrolledByGroup
                    ? t("learningPathsView.enrollment.statuses.enrolledByGroup")
                    : t("learningPathsView.enrollment.statuses.individuallyEnrolled")}
                </Badge>
              ) : (
                <Badge variant="default" className="w-max">
                  {t("learningPathsView.enrollment.statuses.notEnrolled")}
                </Badge>
              )}
            </TableCell>
            <TableCell>
              {user.enrolledAt ? format(new Date(user.enrolledAt), "dd MMM yyyy") : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
