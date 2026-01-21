import { Link, createSearchParams } from "@remix-run/react";
import { HelpCircle } from "lucide-react";

import type { GetAllQAResponse } from "~/api/generated-api";

export const QAEntry = ({
  item,
  onSelect,
}: {
  item: GetAllQAResponse[number];
  onSelect: () => void;
}) => {
  return (
    <Link
      to={{ pathname: "/qa", search: `?${createSearchParams({ qaId: item.id })}` }}
      onClick={onSelect}
      className="group focus:outline-none focus-visible:outline-none"
    >
      <li className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-neutral-900 hover:bg-primary-50 group-focus:bg-primary-100">
        <HelpCircle className="size-4 text-neutral-500" />
        <span className="line-clamp-1 flex-1 body-sm-md">{item.title}</span>
      </li>
    </Link>
  );
};
