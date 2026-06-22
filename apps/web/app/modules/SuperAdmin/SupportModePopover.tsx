import { Check, HandHelping, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSupportUsers } from "~/api/queries/super-admin/useSupportUsers";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useDebounce } from "~/hooks/useDebounce";

import { TENANTS_PAGE_HANDLES } from "../../../e2e/data/tenants/handles";

import type { Tenant } from "~/modules/SuperAdmin/tenants.columns";

type SupportModePopoverProps = {
  tenant: Tenant;
  isSubmitting: boolean;
  onProceed: (tenantId: string, targetUserId: string) => Promise<void>;
};

export function SupportModePopover({ tenant, isSubmitting, onProceed }: SupportModePopoverProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const {
    data: userPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useSupportUsers(
    {
      tenantId: tenant.id,
      search: debouncedSearch,
      perPage: 20,
    },
    { enabled: isOpen },
  );

  const users = useMemo(
    () => userPages?.pages.flatMap((page) => page.data) ?? [],
    [userPages?.pages],
  );

  const emptyLabel = isLoading
    ? t("superAdminTenantsView.supportModePopover.loading")
    : t("superAdminTenantsView.supportModePopover.empty");

  const handleOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen);

    if (!nextOpen) {
      setSearch("");
      setSelectedUserId("");
    }
  };

  const handleProceed = async () => {
    if (!selectedUserId) return;
    await onProceed(tenant.id, selectedUserId);
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          data-testid={TENANTS_PAGE_HANDLES.supportModeButton(tenant.id)}
          size="sm"
          className="gap-2"
          disabled={isSubmitting}
        >
          <HandHelping className="size-4" aria-hidden="true" />
          {t("superAdminTenantsView.table.actions.impersonateAdmin")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-testid={TENANTS_PAGE_HANDLES.SUPPORT_MODE_POPOVER}
        side="bottom"
        align="end"
        sideOffset={10}
        className="w-[min(92vw,24rem)] p-0"
      >
        <Command shouldFilter={false} className="[&_[cmdk-input]]:outline-none">
          <CommandInput
            value={search}
            data-testid={TENANTS_PAGE_HANDLES.SUPPORT_MODE_SEARCH}
            className="outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
            placeholder={t("superAdminTenantsView.supportModePopover.searchPlaceholder")}
            onValueChange={setSearch}
          />
          <CommandList className="min-h-48">
            <CommandEmpty className="flex min-h-48 items-center justify-center">
              {emptyLabel}
            </CommandEmpty>
            <CommandGroup>
              {users.map((user) => {
                const isSelected = user.id === selectedUserId;

                return (
                  <CommandItem
                    key={user.id}
                    data-testid={TENANTS_PAGE_HANDLES.supportModeUserOption(user.id)}
                    value={user.id}
                    disabled={isSubmitting}
                    onSelect={() => setSelectedUserId(user.id)}
                  >
                    <UserAvatar
                      userName={user.label}
                      profilePictureUrl={user.profilePictureUrl}
                      className="size-8"
                    />
                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-950">
                      {user.label}
                    </p>
                    {isSelected && <Check className="size-4 text-primary-700" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {hasNextPage && (
              <div className="border-t border-input p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full gap-2"
                  disabled={isFetchingNextPage}
                  onClick={() => fetchNextPage()}
                >
                  {isFetchingNextPage && <Loader2 className="size-4 animate-spin" />}
                  {t("superAdminTenantsView.supportModePopover.loadMore")}
                </Button>
              </div>
            )}
          </CommandList>
        </Command>
        <div className="flex items-center justify-end gap-2 border-t border-input p-3">
          <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
            {t("common.button.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            data-testid={TENANTS_PAGE_HANDLES.SUPPORT_MODE_SUBMIT}
            disabled={!selectedUserId || isSubmitting}
            onClick={handleProceed}
          >
            {isSubmitting && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("common.button.proceed")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
