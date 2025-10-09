import { Link } from "@remix-run/react";
import { replace, upperFirst, toLower } from "lodash-es";

import type { GetUsersResponse } from "~/api/generated-api";

const normalizeText = (value?: string | null): string => {
  if (!value) return "";
  const spaced = replace(value, /[_-]+/g, " ");
  return upperFirst(toLower(spaced));
};

export const UserEntry = ({
  item,
  onSelect,
}: {
  item: GetUsersResponse["data"][number];
  onSelect: () => void;
}) => {
  return (
    <Link
      to={`/admin/users/${item.id}`}
      onClick={onSelect}
      className="group focus:outline-none focus-visible:outline-none"
    >
      <li className="flex items-center gap-3 rounded-md px-[8px] py-[6px] text-sm text-neutral-900 hover:bg-primary-50 group-focus:bg-primary-100">
        <img
          src={item?.profilePictureUrl ?? ""}
          alt={item.firstName}
          className="size-4 rounded-full bg-[#D9D9D9]"
        />
        <span className="line-clamp-1 flex-1">
          {item.firstName} {item.lastName}
        </span>
        <span className="text-md ps-3 text-neutral-600">{normalizeText(item.role)}</span>
      </li>
    </Link>
  );
};
