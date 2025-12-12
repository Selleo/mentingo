import { useNavigate } from "@remix-run/react";
import { formatDate } from "date-fns";

import { Icon } from "../../components/Icon";
import { cn } from "../../lib/utils";

import type { GetNewsListResponse } from "~/api/generated-api";

type Props = GetNewsListResponse["data"][number] & {
  isBig?: boolean;
};

function NewsItem({ title, authorName, publishedAt, summary, id, isBig = false }: Props) {
  const navigate = useNavigate();

  return (
    <button
      className={cn(
        "relative overflow-hidden rounded-lg py-7 px-6 flex flex-col justify-end min-h-[380px] group",
        {
          "px-10 py-11 min-h-[550px]": isBig,
        },
      )}
      onClick={() => navigate(`/news/${id}`)}
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
        // style={{ backgroundImage: `url(${image})` }}
        aria-hidden
      />
      <GradientOverlay />
      <div className="relative space-y-5 overflow-hidden">
        <h3 className="text-xl font-gothic font-bold leading-6 text-white transition-all duration-300 group-hover:text-primary-500 text-left">
          {title}
        </h3>
        <p className="text-base font-normal leading-7 text-white opacity-95 text-left">{summary}</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Icon name="Calendar" />
            <p className="text-sm font-normal leading-5 text-white opacity-80">
              {publishedAt ? formatDate(new Date(publishedAt), "d MMMM yyyy") : "-"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="User" className="size-4" />
            <p className="text-sm font-normal leading-5 text-white opacity-80">{authorName}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

function GradientOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{
        background:
          "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.65) 30%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.15) 75%, rgba(0,0,0,0) 100%)",
      }}
      aria-hidden
    />
  );
}

export default NewsItem;
