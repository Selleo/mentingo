import { useNavigate, useParams } from "@remix-run/react";
import { useState } from "react";

import { Icon } from "../../components/Icon";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../../components/ui/accordion";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { Separator } from "../../components/ui/separator";
import { cn } from "../../lib/utils";

type Article = { id: string; title: string };
type Section = { id: string; title: string; articles: Article[] };

const sections: Section[] = [
  {
    id: "access-control",
    title: "Zarządzanie dostępem",
    articles: [
      { id: "auth-mfa", title: "Uwierzytelnianie wieloskładnikowe" },
      { id: "zero-trust", title: "Zero Trust Architecture" },
    ],
  },
  {
    id: "data-protection",
    title: "Ochrona danych",
    articles: [
      { id: "encryption-e2e", title: "Szyfrowanie end-to-end" },
      { id: "backup-dr", title: "Backup i disaster recovery" },
    ],
  },
  {
    id: "threat-management",
    title: "Zarządzanie zagrożeniami",
    articles: [
      { id: "phishing", title: "Phishing i social engineering" },
      { id: "ransomware", title: "Ransomware - zapobieganie i" },
    ],
  },
  {
    id: "compliance",
    title: "Compliance i regulacje",
    articles: [
      { id: "gdpr", title: "GDPR i ochrona danych" },
      { id: "iso27001", title: "ISO 27001 - wdrożenie SZBI" },
    ],
  },
];

function AllArticlesTOC() {
  const navigate = useNavigate();
  const { articleId } = useParams();

  const [expanded, setExpanded] = useState<string[]>(sections.map((s) => s.id));

  const innerContent = (
    <div className="flex flex-col w-full pt-4 border-r border-r-border h-full">
      <div className="flex items-center justify-between pb-4 px-4">
        <h3 className="text-base leading-6 text-neutral-950">Baza wiedzy</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size={"icon"}>
              <Icon name="Plus" className="w-4 h-4 text-neutral-900" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => navigate("/articles/add-articles-section")}
            >
              Nowa sekcja
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => navigate("/articles/add-article")}
            >
              Nowy artykuł
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator className="mb-2" />

      <Accordion
        type="multiple"
        value={expanded}
        onValueChange={(vals) => setExpanded(vals as string[])}
        className="px-4"
      >
        {sections.map((section) => {
          const isOpen = expanded.includes(section.id);
          return (
            <AccordionItem key={section.id} value={section.id} className="pb-1">
              <AccordionTrigger className="text-neutral-900 hover:text-primary-700 p-1.5 flex items-center justify-between overflow-hidden">
                <div className="flex items-center gap-2 w-[90%]">
                  <Icon
                    name={isOpen ? "CarretDownLarge" : "ChevronRight"}
                    className="w-4 h-4 text-neutral-700"
                  />
                  <span className="font-medium text-sm text-neutral-950 truncate w-[85%] text-left">
                    {section.title}
                  </span>
                </div>

                <span className="text-neutral-500 text-xs leading-4">
                  {section.articles.length}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="pl-4 gap-0.5">
                  {section.articles.map((article) => (
                    <li key={article.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/articles/${article.id}`)}
                        className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5", {
                          "bg-neutral-200": article.id === articleId,
                        })}
                      >
                        <Icon name="Article" className="w-4 h-4 min-w-4 max-h-4 text-neutral-900" />
                        <span
                          className={cn("truncate text-left text-neutral-900 text-sm", {
                            "text-black": article.id === articleId,
                          })}
                        >
                          {article.title}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );

  return (
    <aside className="md:w-72 min-w-72 relative">
      {/* Mobile: floating menu icon to toggle TOC */}
      <div className="block md:hidden">
        <Accordion type="single" collapsible className="relative">
          <AccordionItem value="toc-mobile">
            <div className="fixed bottom-4 left-4 z-30">
              <AccordionTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-full bg-white/90 p-3 text-lg leading-none text-neutral-900 shadow-md border border-neutral-200"
                >
                  ≡
                </button>
              </AccordionTrigger>
            </div>
            <AccordionContent className="absolute left-0 top-0 z-20 w-72 rounded-md border border-neutral-200 bg-white shadow-lg">
              {innerContent}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Desktop: show full panel, fixed and full-height */}
      {/* 66px is the height of the header navigation */}
      <div className="hidden md:block sticky top-0 max-h-screen overflow-y-auto h-[calc(100vh-66px)] 2xl:h-[100vh]">
        {innerContent}
      </div>
    </aside>
  );
}

export default AllArticlesTOC;
