import { Link } from "@remix-run/react";

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
  wrapperClassName?: string;
  rightSideContent?: ReactNode;
  leftSideContent?: ReactNode;
  aboveBreadcrumbs?: ReactNode;
  /** Rendered at the far right of the breadcrumb bar, e.g. a view switcher. */
  breadcrumbsAction?: ReactNode;
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
    <BreadcrumbList>
      {breadcrumbs.slice(0, lastIndex).map(({ href, title }, index) => (
        <BreadcrumbItem key={index}>
          <BreadcrumbLink asChild className="details-md text-neutral-800 hover:text-neutral-800">
            <Link to={href}>{title}</Link>
          </BreadcrumbLink>
          <BreadcrumbSeparator />
        </BreadcrumbItem>
      ))}
      <BreadcrumbItem>
        <BreadcrumbLink asChild className="details-md text-neutral-950 hover:text-neutral-950">
          <Link to={lastBreadcrumb.href}>{lastBreadcrumb.title}</Link>
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
  rightSideContent,
  leftSideContent,
  wrapperClassName,
  aboveBreadcrumbs,
  breadcrumbsAction,
  ...props
}: PageWrapperProps) => {
  const hasBreadcrumbs = Boolean(breadcrumbs?.length);

  const contentClasses = cn(
    "w-full",
    !isBarebones && "pt-6 px-4 pb-4 md:px-6 md:pb-6 3xl:pt-12 3xl:px-8 3xl:pb-8",
    {
      "pt-0 3xl:pt-0 3xl:pb-2": hasBreadcrumbs,
    },
    className,
  );

  return (
    <div className={cn("flex justify-between", wrapperClassName)}>
      {leftSideContent}

      <div className="flex min-w-0 flex-1 flex-col">
        {aboveBreadcrumbs}
        <div className={contentClasses} {...props}>
          {hasBreadcrumbs && (
            <div
              className={cn(
                "breadcrumbs mb-6 flex min-h-12 items-center justify-between gap-4 border-b border-primary-100 bg-white py-2",
                !isBarebones && "-mx-4 px-4 md:-mx-6 md:px-6 3xl:-mx-8 3xl:px-8",
              )}
            >
              <Breadcrumbs breadcrumbs={breadcrumbs ?? []} />
              {breadcrumbsAction}
            </div>
          )}
          {children}
        </div>
      </div>

      {rightSideContent}
    </div>
  );
};
