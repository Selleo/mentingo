import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { usePhishingReportRecipients } from "~/api/queries/usePhishingReportRecipients";
import { Pagination } from "~/components/Pagination/Pagination";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useDebounce } from "~/hooks/useDebounce";
import { cn } from "~/lib/utils";
import { formatLocalizedDate } from "~/utils/formatLocalizedDate";

import { PhishingCourseStatusBadge } from "./PhishingBadges";
import { PHISHING_ACTIVITY_COLORS } from "./phishingReport.styles";
import { RECIPIENT_COLUMNS, RECIPIENT_FILTERS, toApiSort } from "./phishingReport.utils";

import type {
  PhishingReportSummary,
  RecipientFilter,
  RecipientSort,
  RecipientSortField,
} from "./phishingReport.utils";
import type { ItemsPerPageOption } from "~/components/Pagination/Pagination";

const SORT_ICONS = { asc: ArrowUp, desc: ArrowDown } as const;
const ARIA_SORT = { asc: "ascending", desc: "descending" } as const;
const ALL_GROUPS = "all";
const DEFAULT_SORT: RecipientSort = { field: "name", direction: "asc" };
const DEFAULT_PER_PAGE: ItemsPerPageOption = 20;

function SortableHead({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: RecipientSortField;
  sort: RecipientSort;
  onSort: (field: RecipientSortField) => void;
}) {
  const { t } = useTranslation();
  const active = sort.field === field;
  const SortIcon = active ? SORT_ICONS[sort.direction] : ArrowUpDown;

  return (
    <TableHead scope="col" aria-sort={active ? ARIA_SORT[sort.direction] : "none"}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-3 h-8 gap-1.5 px-3 font-medium text-neutral-600 hover:text-neutral-950"
        aria-label={t("phishing.sortBy", { column: label })}
        onClick={() => onSort(field)}
      >
        {label}
        <SortIcon className={cn("size-3.5", active ? "text-neutral-950" : "text-neutral-400")} />
      </Button>
    </TableHead>
  );
}

/** Long group names shorten with an ellipsis so the risk rate always stays visible. */
function GroupOption({ name, riskRate }: { name: string; riskRate: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2" title={name}>
      <span className="truncate">{name}</span>
      <span className="shrink-0 tabular-nums text-neutral-500">{riskRate}%</span>
    </span>
  );
}

export function PhishingPeopleTable({
  campaignId,
  groups,
  totalRecipients,
  tracksSubmissions,
}: {
  campaignId: string;
  groups: PhishingReportSummary["groups"];
  totalRecipients: number;
  tracksSubmissions: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RecipientFilter>(RECIPIENT_FILTERS.ALL);
  const [groupId, setGroupId] = useState<string>(ALL_GROUPS);
  const [sort, setSort] = useState<RecipientSort>(DEFAULT_SORT);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState<ItemsPerPageOption>(DEFAULT_PER_PAGE);
  const debouncedSearch = useDebounce(search.trim());
  const { data, isPending } = usePhishingReportRecipients(campaignId, {
    search: debouncedSearch || undefined,
    groupId: groupId === ALL_GROUPS ? undefined : groupId,
    filter,
    sort: toApiSort(sort),
    page,
    perPage,
  });
  const recipients = data?.data ?? [];
  const selectedGroup = groups.find((group) => group.id === groupId);
  const columns = RECIPIENT_COLUMNS.filter(
    (column) => tracksSubmissions || column.key !== "submitted",
  );

  // Every change to the query starts again from the first page.
  function updateQuery(update: () => void) {
    update();
    setPage(1);
  }

  function toggleSort(field: RecipientSortField) {
    updateQuery(() =>
      setSort((current) =>
        current.field === field
          ? { field, direction: current.direction === "asc" ? "desc" : "asc" }
          : { field, direction: field === "name" ? "asc" : "desc" },
      ),
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h5 className="h5 text-neutral-950">{t("phishing.people")}</h5>
        <div className="flex w-full flex-wrap gap-3 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => updateQuery(() => setSearch(event.target.value))}
              placeholder={t("phishing.searchPeople")}
              aria-label={t("phishing.searchPeople")}
              className="pl-9"
            />
          </div>
          {groups.length > 0 && (
            <Select value={groupId} onValueChange={(value) => updateQuery(() => setGroupId(value))}>
              <SelectTrigger className="w-60" aria-label={t("phishing.groups")}>
                <SelectValue>
                  {selectedGroup ? (
                    <GroupOption
                      name={selectedGroup.name}
                      riskRate={selectedGroup.totals.riskRate}
                    />
                  ) : (
                    t("phishing.filters.allGroups")
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_GROUPS}>{t("phishing.filters.allGroups")}</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <GroupOption name={group.name} riskRate={group.totals.riskRate} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select
            value={filter}
            onValueChange={(value) => updateQuery(() => setFilter(value as RecipientFilter))}
          >
            <SelectTrigger className="w-44" aria-label={t("phishing.filters.all")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(RECIPIENT_FILTERS).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`phishing.filters.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table className="border bg-neutral-50" aria-label={t("phishing.people")}>
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const label = t(`phishing.columns.${column.key}`);
                return "sortField" in column ? (
                  <SortableHead
                    key={column.key}
                    label={label}
                    field={column.sortField}
                    sort={sort}
                    onSort={toggleSort}
                  />
                ) : (
                  <TableHead key={column.key} scope="col">
                    {label}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody aria-busy={isPending}>
            {!isPending && !recipients.length && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-12 text-center text-muted-foreground"
                >
                  {totalRecipients ? t("phishing.noMatches") : t("phishing.noResults")}
                </TableCell>
              </TableRow>
            )}
            {recipients.map((r) => (
              <TableRow key={r.userId}>
                <TableCell>
                  <div className="flex flex-col text-sm">
                    <span>
                      {r.firstName} {r.lastName}
                    </span>
                    <span className="text-muted-foreground">{r.email}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.sentAt ? formatLocalizedDate(i18n.language, r.sentAt) : t("phishing.pending")}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-sm",
                    r.clickedAt
                      ? ["font-medium", PHISHING_ACTIVITY_COLORS.clicked.text]
                      : "text-muted-foreground",
                  )}
                >
                  {formatLocalizedDate(i18n.language, r.clickedAt)}
                </TableCell>
                {tracksSubmissions && (
                  <TableCell
                    className={cn(
                      "text-sm",
                      r.submittedAt
                        ? ["font-medium", PHISHING_ACTIVITY_COLORS.submitted.text]
                        : "text-muted-foreground",
                    )}
                  >
                    {formatLocalizedDate(i18n.language, r.submittedAt)}
                  </TableCell>
                )}
                <TableCell>
                  <PhishingCourseStatusBadge status={r.courseStatus} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          className="rounded-b-lg border-x border-b bg-neutral-50"
          emptyDataClassName="rounded-b-lg border-x border-b bg-neutral-50"
          totalItems={data?.pagination.totalItems}
          currentPage={page}
          itemsPerPage={perPage}
          onPageChange={setPage}
          onItemsPerPageChange={(value) =>
            updateQuery(() => setPerPage(Number(value) as ItemsPerPageOption))
          }
        />
      </div>
    </section>
  );
}
