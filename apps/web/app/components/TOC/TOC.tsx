import { Link } from "@remix-run/react";
import { useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

type Props = {
  /** Raw HTML string containing the content to scan for headings */
  contentHtml: string | null | undefined;
  /** Optional callback to expose the HTML with injected heading ids for rendering */
  onContentWithIds?: (html: string) => void;
};

export const TOC = ({ contentHtml, onContentWithIds }: Props) => {
  const { t } = useTranslation();
  const { items, contentWithIds } = useMemo(() => {
    if (!contentHtml) return { items: [], contentWithIds: "" };
    if (typeof window === "undefined") return { items: [], contentWithIds: contentHtml };

    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml, "text/html");
    const headings = Array.from(doc.querySelectorAll<HTMLElement>("h1, h2, h3, h4")).map(
      (el, idx) => {
        if (!el.id || el.id === "") {
          const baseId =
            (el.innerText || "heading")
              .toLowerCase()
              .trim()
              .replace(/[\s]+/g, "-")
              .replace(/[^\w-]/g, "")
              .replace(/-+/g, "-")
              .slice(0, 64) || "heading";
          el.id = `${baseId}-${idx}`;
        }

        return {
          id: el.id,
          text: el.innerText?.trim() || `Heading ${idx + 1}`,
          level: Number(el.tagName.substring(1)),
        };
      },
    );

    return { items: headings, contentWithIds: doc.body.innerHTML };
  }, [contentHtml]);

  const handleScroll = useCallback((id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const hasItems = items.length > 0;

  const listItems = useMemo(
    () =>
      items.map((item) => (
        <li
          key={item.id}
          className="px-2 py-1.5 rounded-sm group cursor-pointer transition-colors duration-100 hover:bg-[#3F58B633]"
        >
          <Link
            to={`#${item.id}`}
            className={cn("block text-sm leading-5 text-neutral-900 group-hover:text-primary-700", {
              "pl-0": item.level === 1,
              "pl-1": item.level === 2,
              "pl-2": item.level === 3,
              "pl-3": item.level === 4,
            })}
            onClick={(e) => {
              e.preventDefault();
              handleScroll(item.id);
            }}
          >
            {item.text}
          </Link>
        </li>
      )),
    [items, handleScroll],
  );

  useEffect(() => {
    if (onContentWithIds) {
      onContentWithIds(contentWithIds);
    }
  }, [contentWithIds, onContentWithIds]);

  if (!hasItems) return null;

  return (
    // 66px is the height of the header navigation
    <div className="p-6 border-l border-l-border gap-4 w-80 self-start sticky top-0 h-[calc(100vh-66px)] overflow-auto 2xl:h-[100vh] 2xl:top-0 hidden md:block bg-white">
      <h4 className="uppercase text-xs text-neutral-700">{t("common.tableOfContents")}</h4>

      <ul className="mt-3 flex flex-col gap-2 text-neutral-900 text-sm leading-5">{listItems}</ul>
    </div>
  );
};
