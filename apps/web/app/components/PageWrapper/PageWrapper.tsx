import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { cn } from "~/lib/utils";

import type { HTMLAttributes, ReactNode } from "react";

type PageWrapperProps = HTMLAttributes<HTMLDivElement> & {
  breadcrumbs?: { title: string; href: string }[];
  isBarebones?: boolean;
  children: ReactNode;
  className?: string;
  sideContent?: ReactNode;
};

type Breadcrumb = { title: string; href: string };

type BreadcrumbsProps = {
  breadcrumbs: Breadcrumb[];
};

export const Breadcrumbs = ({ breadcrumbs = [] }: BreadcrumbsProps) => {
  if (!breadcrumbs.length) return null;

  const lastIndex = breadcrumbs.length - 1;
  const lastBreadcrumb = breadcrumbs[lastIndex];

  return (
    <BreadcrumbList className="mb-4">
      {breadcrumbs.slice(0, lastIndex).map(({ href, title }, index) => (
        <BreadcrumbItem key={index}>
          <BreadcrumbLink
            className="details-md text-neutral-800 hover:text-neutral-800"
            href={href}
          >
            {title}
          </BreadcrumbLink>
          <BreadcrumbSeparator />
        </BreadcrumbItem>
      ))}
      <BreadcrumbItem>
        <BreadcrumbLink
          className="details-md text-neutral-950 hover:text-neutral-950"
          href={lastBreadcrumb.href}
        >
          {lastBreadcrumb.title}
        </BreadcrumbLink>
      </BreadcrumbItem>
    </BreadcrumbList>
  );
};

export const PageWrapper = ({
  className,
  breadcrumbs,
  isBarebones,
  children,
  sideContent,
  ...props
}: PageWrapperProps) => {
  const hasBreadcrumbs = Boolean(breadcrumbs);

  const classes = cn(
    !isBarebones && "w-full pt-6 px-4 pb-4 md:px-6 md:pb-6 3xl:pt-12 3xl:px-8 3xl:pb-8",
    {
      "pt-8 md:pt-6 3xl:pt-6 3xl:pb-2 [&_.breadcrumbs]:mb-2": hasBreadcrumbs,
    },
    className,
  );

  return (
    <div className="flex justify-between">
      <div className={classes} {...props}>
        {breadcrumbs && (
          <div className="breadcrumbs">
            <Breadcrumbs breadcrumbs={breadcrumbs} />
          </div>
        )}
        {children}
      </div>

      {sideContent}
    </div>
  );
};
