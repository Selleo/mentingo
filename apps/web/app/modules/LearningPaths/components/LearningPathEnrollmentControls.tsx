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
import { cn } from "~/lib/utils";
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

const ENROLLMENT_MENU_ITEM_CLASS_NAME =
  "body-sm flex h-10 w-full cursor-pointer items-center justify-start gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium outline-none transition focus:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

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
            <DropdownMenuItem
              className={cn(ENROLLMENT_MENU_ITEM_CLASS_NAME, "text-neutral-950")}
              disabled={!selectedNotEnrolledCount || isPending}
              onSelect={onOpenUserEnroll}
            >
              <Icon name="Plus" className="size-4 text-accent-foreground mono:text-current" />
              {t("learningPathsView.enrollment.enrollSelected")}
              {!!selectedNotEnrolledCount && ` (${selectedNotEnrolledCount})`}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className={cn(ENROLLMENT_MENU_ITEM_CLASS_NAME, "text-error-700")}
              disabled={!selectedEnrolledCount || isPending}
              onSelect={onOpenUserUnenroll}
            >
              <Minus className="size-4 text-error-700 mono:text-current" />
              {t("learningPathsView.enrollment.unenrollSelected")}
              {!!selectedEnrolledCount && ` (${selectedEnrolledCount})`}
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
            <DropdownMenuItem
              className={cn(ENROLLMENT_MENU_ITEM_CLASS_NAME, "text-neutral-950")}
              onSelect={onOpenGroupEnroll}
            >
              <Icon name="Plus" className="size-4 text-accent-foreground mono:text-current" />
              {t("learningPathsView.enrollment.enrollGroups")}
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              className={cn(ENROLLMENT_MENU_ITEM_CLASS_NAME, "text-error-700")}
              onSelect={onOpenGroupUnenroll}
            >
              <Minus className="size-4 text-error-700 mono:text-current" />
              {t("learningPathsView.enrollment.unenrollGroups")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
