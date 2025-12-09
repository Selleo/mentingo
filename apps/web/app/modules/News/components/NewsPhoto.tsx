type NewsPhotoProps = {
  alt: string;
  url: string;
  description?: string;
};

export const NewsPhoto = ({ alt, url, description }: NewsPhotoProps) => {
  return (
    <div className="flex flex-col gap-3">
      <figure className="w-full overflow-hidden rounded-lg shadow-sm">
        <img src={url} alt={alt} className="w-full h-auto object-cover" />
      </figure>

      {description && (
        <p className="text-sm text-neutral-600 leading-6 text-center">{description}</p>
      )}
    </div>
  );
};
