import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import type { ReactNode } from "react";

type BrandingImageTileProps = {
  id?: string;
  testId: string;
  title: string;
  description: string;
  children: ReactNode;
};

export const BrandingImageTile = ({
  id,
  testId,
  title,
  description,
  children,
}: BrandingImageTileProps) => (
  <section id={id} data-testid={testId} className="flex h-full min-w-0 flex-col gap-3">
    <div className="flex flex-1 flex-col gap-0.5">
      <h3 className="body-base-md text-neutral-950">{title}</h3>
      <p className="body-sm line-clamp-2 text-neutral-600" title={description}>
        {description}
      </p>
    </div>
    {children}
  </section>
);

type BrandingImageActionProps = {
  label: string;
  onClick: () => void;
  testId?: string;
  isDestructive?: boolean;
  children: ReactNode;
};

export const BrandingImageAction = ({
  label,
  onClick,
  testId,
  isDestructive = false,
  children,
}: BrandingImageActionProps) => (
  <Button
    type="button"
    variant="outline"
    size="icon"
    className={cn("size-8 bg-white/90 shadow-sm backdrop-blur-sm", {
      "text-error-600 hover:text-error-700": isDestructive,
    })}
    aria-label={label}
    title={label}
    onClick={onClick}
    data-testid={testId}
  >
    {children}
  </Button>
);
