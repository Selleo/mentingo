import { Icon } from "../../../components/Icon";

type NewsFileProps = {
  name: string;
  url: string;
  meta?: string;
};

export const NewsFile = ({ name, url, meta }: NewsFileProps) => {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg border border-primary-100 bg-neutral-600 p-5 hover:bg-white transition"
    >
      <div className="flex items-center gap-3">
        <Icon name="Directory" className="text-primary-700" />
        <div className="flex flex-col">
          <span className="text-base font-semibold text-neutral-900">{name}</span>
          {meta && <span className="text-xs text-neutral-600">{meta}</span>}
        </div>
      </div>
      <Icon name="ArrowDown" className="text-primary-700" />
    </a>
  );
};
