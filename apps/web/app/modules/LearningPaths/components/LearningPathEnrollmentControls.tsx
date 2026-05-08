import { Minus, User, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { SearchFilter } from "~/modules/common/SearchFilter/SearchFilter";

import type {
  FilterConfig,
  FilterValue,
  FilterValues,
} from "~/modules/common/SearchFilter/SearchFilter";

type LearningPathEnrollmentControlsProps = {
  isPending: boolean;
  filterConfig: FilterConfig[];
  filterValues: FilterValues;
  isLoading?: boolean;
  hasGroups: boolean;
  selectedNotEnrolledCount: number;
  selectedEnrolledCount: number;
  isUserDropdownOpen: boolean;
  isGroupDropdownOpen: boolean;
  onFilterChange: (name: string, value: FilterValue) => void;
  setIsUserDropdownOpen: (isOpen: boolean) => void;
  setIsGroupDropdownOpen: (isOpen: boolean) => void;
  onOpenUserEnroll: () => void;
  onOpenUserUnenroll: () => void;
  onOpenGroupEnroll: () => void;
  onOpenGroupUnenroll: () => void;
};

export function LearningPathEnrollmentControls({
  isPending,
  filterConfig,
  filterValues,
  isLoading,
  hasGroups,
  selectedNotEnrolledCount,
  selectedEnrolledCount,
  isUserDropdownOpen,
  isGroupDropdownOpen,
  onFilterChange,
  setIsUserDropdownOpen,
  setIsGroupDropdownOpen,
  onOpenUserEnroll,
  onOpenUserUnenroll,
  onOpenGroupEnroll,
  onOpenGroupUnenroll,
}: LearningPathEnrollmentControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <SearchFilter
        filters={filterConfig}
        values={filterValues}
        onChange={onFilterChange}
        isLoading={isLoading}
      />
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu onOpenChange={setIsUserDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="gap-2" disabled={isPending}>
              <User className="size-4" />
              {t("learningPathsView.enrollment.enroll")}
              <Icon
                className="size-4 text-black"
                name={isUserDropdownOpen ? "ArrowUp" : "ArrowDown"}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 rounded bg-white p-2 text-black shadow-lg transition-all duration-200">
            <DropdownMenuItem>
              <Button
                type="button"
                className="body-sm w-full justify-start gap-2 text-neutral-950 hover:text-neutral-950"
                variant="ghost"
                disabled={!selectedNotEnrolledCount || isPending}
                onClick={onOpenUserEnroll}
              >
                <Icon name="Plus" className="size-4 text-accent-foreground" />
                {t("learningPathsView.enrollment.enrollSelected")}
                {!!selectedNotEnrolledCount && ` (${selectedNotEnrolledCount})`}
              </Button>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Button
                type="button"
                className="body-sm w-full justify-start gap-2 text-error-700 hover:text-error-700"
                variant="ghost"
                disabled={!selectedEnrolledCount || isPending}
                onClick={onOpenUserUnenroll}
              >
                <Minus className="size-4 text-error-700" />
                {t("learningPathsView.enrollment.unenrollSelected")}
                {!!selectedEnrolledCount && ` (${selectedEnrolledCount})`}
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu onOpenChange={setIsGroupDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!hasGroups || isPending}
            >
              <Users className="size-4" />
              {t("learningPathsView.enrollment.enrollGroups")}
              <Icon
                className="size-4 text-black"
                name={isGroupDropdownOpen ? "ArrowUp" : "ArrowDown"}
              />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 rounded bg-white p-2 text-black shadow-lg transition-all duration-200">
            <DropdownMenuItem>
              <Button
                type="button"
                className="body-sm w-full justify-start gap-2 text-neutral-950 hover:text-neutral-950"
                variant="ghost"
                onClick={onOpenGroupEnroll}
              >
                <Icon name="Plus" className="size-4 text-accent-foreground" />
                {t("learningPathsView.enrollment.enrollGroups")}
              </Button>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Button
                type="button"
                className="body-sm w-full justify-start gap-2 text-error-700 hover:text-error-700"
                variant="ghost"
                onClick={onOpenGroupUnenroll}
              >
                <Minus className="size-4 text-error-700" />
                {t("learningPathsView.enrollment.unenrollGroups")}
              </Button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
