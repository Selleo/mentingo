import { LIVE_TRAINING_SESSION_STATUSES } from "@repo/shared";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { CalendarClock, ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLiveTrainingSession } from "~/api/queries/live-training/useLiveTrainingSession";
import { useLiveTrainingSessions } from "~/api/queries/live-training/useLiveTrainingSessions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { formatLiveTrainingDateRange } from "~/modules/LiveTraining/utils/liveTrainingFormat";

import type { ColumnDef } from "@tanstack/react-table";
import type { GetSessionResponse, GetSessionsResponse } from "~/api/generated-api";

type LiveTrainingSessionsPanelProps = {
  liveTrainingId: string;
};

type LiveTrainingSessionSummary = GetSessionsResponse["data"][number];
type LiveTrainingAttendanceRow = GetSessionResponse["data"]["participants"][number];

const getSessionBadgeVariant = (status: LiveTrainingSessionSummary["status"]) => {
  if (status === LIVE_TRAINING_SESSION_STATUSES.ENDED) return "success";
  if (status === LIVE_TRAINING_SESSION_STATUSES.FAILED) return "destructive";
  if (status === LIVE_TRAINING_SESSION_STATUSES.ACTIVE) return "inProgress";

  return "notStarted";
};

const formatDateTime = (value: string | null, language: string) => {
  if (!value) return null;

  return new Intl.DateTimeFormat(language, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatDuration = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;

  return `${seconds}s`;
};

function LiveTrainingSessionsSkeleton() {
  return (
    <section className="grid gap-3 rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-20 rounded-md" />
      <Skeleton className="h-20 rounded-md" />
    </section>
  );
}

function LiveTrainingSessionAttendanceTable({
  liveTrainingId,
  sessionId,
  isOpen,
}: {
  liveTrainingId: string;
  sessionId: string;
  isOpen: boolean;
}) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data: session, isLoading } = useLiveTrainingSession(liveTrainingId, sessionId, language, {
    enabled: isOpen,
  });

  const columns = useMemo<ColumnDef<LiveTrainingAttendanceRow>[]>(
    () => [
      {
        accessorKey: "user.fullName",
        header: t("liveTrainingView.sessions.attendance.user"),
        cell: ({ row }) => {
          const participant = row.original;
          const name = participant.user.fullName ?? t("liveTrainingView.sidebar.unknownUser");

          return (
            <div className="flex min-w-48 items-center gap-2">
              <UserAvatar
                userName={name}
                profilePictureUrl={participant.user.profilePictureUrl}
                className="size-8"
              />
              <span className="truncate font-medium text-neutral-950">{name}</span>
            </div>
          );
        },
      },
      {
        accessorKey: "role",
        header: t("liveTrainingView.sessions.attendance.role"),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            fontWeight="normal"
            className="w-fit rounded px-2 py-0.5 text-xs"
          >
            {t(`liveTrainingView.sessions.roles.${row.original.role}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "totalSeconds",
        header: t("liveTrainingView.sessions.attendance.totalTime"),
        cell: ({ row }) => formatDuration(row.original.totalSeconds),
      },
      {
        accessorKey: "firstJoinedAt",
        header: t("liveTrainingView.sessions.attendance.firstJoinedAt"),
        cell: ({ row }) =>
          formatDateTime(row.original.firstJoinedAt, language) ??
          t("liveTrainingView.sessions.notAvailable"),
      },
      {
        accessorKey: "lastLeftAt",
        header: t("liveTrainingView.sessions.attendance.lastLeftAt"),
        cell: ({ row }) =>
          formatDateTime(row.original.lastLeftAt, language) ??
          t("liveTrainingView.sessions.notAvailable"),
      },
      {
        accessorKey: "joinCount",
        header: t("liveTrainingView.sessions.attendance.joinCount"),
      },
    ],
    [language, t],
  );

  const table = useReactTable({
    data: session?.participants ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 rounded-md" />
      </div>
    );
  }

  if (!session?.participants.length) {
    return (
      <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        {t("liveTrainingView.sessions.attendance.empty")}
      </div>
    );
  }

  return (
    <div className="max-w-full overflow-x-auto rounded-md border border-neutral-200">
      <Table className="min-w-[56rem]">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="h-10 whitespace-nowrap px-3 text-xs">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="whitespace-nowrap px-3 py-2 text-sm">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LiveTrainingSessionCard({
  liveTrainingId,
  session,
  openedSessionId,
}: {
  liveTrainingId: string;
  session: LiveTrainingSessionSummary;
  openedSessionId: string | undefined;
}) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const startedAt = session.startedAt;
  const endedAt = session.endedAt ?? new Date().toISOString();
  const dateRange = startedAt
    ? formatLiveTrainingDateRange(startedAt, endedAt, false, language)
    : null;

  return (
    <AccordionItem
      value={session.id}
      className="max-w-full overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm"
    >
      <AccordionTrigger className="gap-4 px-4 py-3 text-left hover:no-underline">
        <div className="grid min-w-0 flex-1 gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={getSessionBadgeVariant(session.status)}
              fontWeight="normal"
              className="rounded px-2 py-0.5 text-xs"
            >
              {t(`liveTrainingView.sessions.status.${session.status}`)}
            </Badge>
            {dateRange && (
              <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-neutral-600">
                <CalendarClock className="size-4 shrink-0 text-neutral-400" />
                <span className="truncate">{dateRange}</span>
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-neutral-500">
            <span>
              {t("liveTrainingView.sessions.startedBy")}:{" "}
              {session.startedBy?.fullName ?? t("liveTrainingView.sidebar.unknownUser")}
            </span>
            <span>
              {t("liveTrainingView.sessions.endedBy")}:{" "}
              {session.endedBy?.fullName ?? t("liveTrainingView.sessions.notEnded")}
            </span>
          </div>
        </div>
        <ChevronDown className="size-4 shrink-0 text-neutral-500 transition-transform duration-200 data-[state=open]:rotate-180" />
      </AccordionTrigger>
      <AccordionContent className="max-w-full overflow-hidden border-t border-neutral-100 px-4 py-3">
        <LiveTrainingSessionAttendanceTable
          liveTrainingId={liveTrainingId}
          sessionId={session.id}
          isOpen={openedSessionId === session.id}
        />
      </AccordionContent>
    </AccordionItem>
  );
}

export function LiveTrainingSessionsPanel({ liveTrainingId }: LiveTrainingSessionsPanelProps) {
  const { t } = useTranslation();
  const [openedSessionId, setOpenedSessionId] = useState<string>();
  const language = useLanguageStore((state) => state.language);
  const { data: sessions = [], isLoading } = useLiveTrainingSessions(liveTrainingId, language, {
    enabled: Boolean(liveTrainingId),
  });

  if (isLoading) return <LiveTrainingSessionsSkeleton />;

  return (
    <section className="max-w-full overflow-hidden rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-neutral-950">
          {t("liveTrainingView.sessions.title")}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          {t("liveTrainingView.sessions.description")}
        </p>
      </div>

      {sessions.length > 0 ? (
        <Accordion
          type="single"
          collapsible
          value={openedSessionId}
          onValueChange={setOpenedSessionId}
          className="grid max-w-full gap-3 overflow-hidden"
        >
          {sessions.map((session) => (
            <LiveTrainingSessionCard
              key={session.id}
              liveTrainingId={liveTrainingId}
              session={session}
              openedSessionId={openedSessionId}
            />
          ))}
        </Accordion>
      ) : (
        <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
          {t("liveTrainingView.sessions.empty")}
        </div>
      )}
    </section>
  );
}
