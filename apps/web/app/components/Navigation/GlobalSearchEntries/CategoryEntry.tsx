import { Link } from "@remix-run/react";

import type { GetAllCategoriesResponse } from "~/api/generated-api";

export const CategoryEntry = ({
  item,
  onSelect,
}: {
  item: GetAllCategoriesResponse["data"][number];
  onSelect: () => void;
}) => {
  return (
    <Link to={`/admin/categories/${item.id}`} onClick={onSelect}>
      <li className="flex items-center gap-3 rounded-md px-[8px] py-[6px] text-sm text-neutral-900 hover:bg-primary-50">
        <span className="line-clamp-1 flex-1">{item.title}</span>
      </li>
    </Link>
  );
};
