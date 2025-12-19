import { Link } from "@remix-run/react";

import { Icon } from "~/components/Icon";

import type { GetArticlesResponse } from "~/api/generated-api";

export const ArticleEntry = ({
  item,
  onSelect,
}: {
  item: GetArticlesResponse[number];
  onSelect: () => void;
}) => {
  return (
    <Link
      to={`/articles/${item.id}`}
      onClick={onSelect}
      className="group focus:outline-none focus-visible:outline-none"
    >
      <li className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm text-neutral-900 hover:bg-primary-50 group-focus:bg-primary-100">
        <Icon name="Articles" className="size-4 text-neutral-500" />
        <span className="line-clamp-1 flex-1 body-sm-md">{item.title}</span>
      </li>
    </Link>
  );
};
