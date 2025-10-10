import { Link } from "@remix-run/react";

import type { GetAllGroupsResponse } from "~/api/generated-api";

export const GroupEntry = ({
  item,
  onSelect,
}: {
  item: GetAllGroupsResponse["data"][number];
  onSelect: () => void;
}) => {
  return (
    <Link
      to={`/admin/groups/${item.id}`}
      onClick={onSelect}
      className="group focus:outline-none focus-visible:outline-none"
    >
      <li className="rounded-md px-[8px] py-[6px] text-sm text-neutral-800 hover:bg-primary-50 group-focus:bg-primary-100">
        <span className="line-clamp-1">{item.name}</span>
      </li>
    </Link>
  );
};
