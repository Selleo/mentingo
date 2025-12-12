import { Link, NavLink } from "@remix-run/react";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

type PublicMobileNavigationDropdownProps = {
  links: { to: string; label: string }[];
  menuLabel: string;
  closeLabel: string;
  loginLabel: string;
  signUpLabel: string;
};

export function PublicMobileNavigationDropdown({
  links,
  menuLabel,
  closeLabel,
  loginLabel,
  signUpLabel,
}: PublicMobileNavigationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleLabel = isOpen ? closeLabel : menuLabel;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label={toggleLabel}
          className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-neutral-900 shadow-sm ring-1 ring-primary-200 transition-colors hover:bg-primary-50 md:hidden"
        >
          {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          <span className="body-sm-md">{toggleLabel}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="center"
        sideOffset={0}
        className="border border-primary-100 bg-white p-2 mt-2 shadow-xl md:hidden w-dvw"
      >
        <div className="flex flex-col gap-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                cn(
                  "body-sm-md flex items-center gap-3 rounded-lg px-4 py-3.5 transition-colors hover:outline hover:outline-1 hover:outline-primary-200",
                  isActive
                    ? "border border-primary-200 bg-primary-50 text-primary-800"
                    : "bg-white text-neutral-900",
                )
              }
            >
              <span className="truncate">{link.label}</span>
            </NavLink>
          ))}

          <Separator className="bg-neutral-200" />

          <Link to="/auth/login" onClick={() => setIsOpen(false)}>
            <Button variant="outline" className="w-full">
              {loginLabel}
            </Button>
          </Link>
          <Link to="/auth/register" onClick={() => setIsOpen(false)}>
            <Button className="w-full">{signUpLabel}</Button>
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
