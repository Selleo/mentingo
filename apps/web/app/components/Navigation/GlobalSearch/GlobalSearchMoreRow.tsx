import { Link } from "@remix-run/react";
import { MoreHorizontal } from "lucide-react";

type GlobalSearchMoreRowProps = {
  to: string;
  label: string;
  onSelect: () => void;
};

/** Collapsed remainder of a course group; opens the course, where every lesson is listed. */
export const GlobalSearchMoreRow = ({ to, label, onSelect }: GlobalSearchMoreRowProps) => (
  <Link
    to={to}
    onClick={onSelect}
    className="flex items-center gap-2.5 rounded-md px-2.5 py-1 outline-none hover:bg-neutral-50 focus-visible:bg-primary-50"
  >
    <span className="flex size-5 shrink-0 items-center justify-center text-neutral-400">
      <MoreHorizontal className="size-4" aria-hidden />
    </span>
    <span className="details text-primary-700">{label}</span>
  </Link>
);
