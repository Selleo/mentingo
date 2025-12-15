import { formatDate } from "date-fns";

import { Icon } from "~/components/Icon";

import { cn } from "../../lib/utils";

interface Props {
  title: string;
  introduction: string;
  author: string;
  createdAt: string;
  image: string;
  content: string;
  isBig?: boolean;
}

function NewsItem({ title, introduction, author, createdAt, image, isBig = false }: Props) {
  return (
    <div
      className={cn(
        "relative bg-cover bg-center rounded-lg py-7 px-6 flex flex-col justify-end min-h-[380px]",
        {
          "px-10 py-11 min-h-[550px]": isBig,
        },
      )}
      style={{ backgroundImage: `url(${image})` }}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden />
      <div className="relative space-y-5 overflow-hidden">
        <h3 className="text-xl font-gothic font-bold leading-6 text-white">{title}</h3>
        <p className="text-base font-normal leading-7 text-white opacity-95">{introduction}</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Icon name="Calendar" />
            <p className="text-sm font-normal leading-5 text-white opacity-80">
              {formatDate(createdAt, "d MMMM yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="User" className="size-4" />
            <p className="text-sm font-normal leading-5 text-white opacity-80">{author}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewsItem;
