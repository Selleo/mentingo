import { Link } from "@remix-run/react";
import { enUS, pl } from "date-fns/locale";
import { format } from "node_modules/date-fns/format";

import { Icon } from "~/components/Icon";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { GetAnnouncementsForUserResponse } from "~/api/generated-api";

export const AnnouncementEntry = ({
  item,
  onSelect,
}: {
  item: GetAnnouncementsForUserResponse["data"][number];
  onSelect: () => void;
}) => {
  const language = useLanguageStore((state) => state.language);

  const date = format(new Date(item.createdAt), "d MMM yyyy", {
    locale: language === "en" ? enUS : pl,
  });
  return (
    <Link to={`/announcements#${item.id}`} onClick={onSelect}>
      <li className="flex items-center gap-3 rounded-md px-[8px] py-[6px] text-sm text-neutral-900 hover:bg-primary-50">
        <Icon name="Megaphone" className="size-4 text-neutral-900" />
        <span className="line-clamp-1 flex-1">{item.title}</span>
        <span className="text-md ps-3 text-neutral-600">{date}</span>
      </li>
    </Link>
  );
};
