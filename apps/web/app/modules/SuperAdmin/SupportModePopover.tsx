import { SUPPORT_USER_SCOPES } from "@repo/shared";
import { Check, HandHelping, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSupportRoles } from "~/api/queries/super-admin/useSupportRoles";
import { useSupportUsers } from "~/api/queries/super-admin/useSupportUsers";
import { Badge } from "~/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { UserAvatar } from "~/components/UserProfile/UserAvatar";
import { useDebounce } from "~/hooks/useDebounce";
import { getRoleLabel } from "~/modules/Admin/Users/utils/getRoleLabel";

import { TENANTS_PAGE_HANDLES } from "../../../e2e/data/tenants/handles";

import type { Tenant } from "~/modules/SuperAdmin/tenants.columns";

type SupportUserScope = (typeof SUPPORT_USER_SCOPES)[keyof typeof SUPPORT_USER_SCOPES];

type SupportModePopoverProps = {
  tenant: Tenant;
  isSubmitting: boolean;
  onProceed: (tenantId: string, targetUserId: string) => Promise<void>;
};

export function SupportModePopover({ tenant, isSubmitting, onProceed }: SupportModePopoverProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<SupportUserScope>(SUPPORT_USER_SCOPES.ADMINS);
  const [search, setSearch] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
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
      scope,
      roleSlug: scope === SUPPORT_USER_SCOPES.ALL ? roleSlug : undefined,
    },
    { enabled: isOpen },
  );
  const { data: roles = [], isLoading: isLoadingRoles } = useSupportRoles(
    tenant.id,
    isOpen && scope === SUPPORT_USER_SCOPES.ALL,
  );

  const users = useMemo(
    () => userPages?.pages.flatMap((page) => page.data) ?? [],
    [userPages?.pages],
  );

  const hasSearch = Boolean(search.trim());
  const showSearchAllUsers =
    scope === SUPPORT_USER_SCOPES.ADMINS && hasSearch && !isLoading && users.length === 0;

  const getEmptyMessage = () => {
    if (showSearchAllUsers) {
      return t("superAdminTenantsView.supportModePopover.emptyAdminsSearch", {
        search: search.trim(),
      });
    }

    if (scope === SUPPORT_USER_SCOPES.ADMINS) {
      return t("superAdminTenantsView.supportModePopover.emptyAdmins");
    }
    if (roleSlug) return t("superAdminTenantsView.supportModePopover.emptyRole");

    return t("superAdminTenantsView.supportModePopover.emptyAllUsers");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setIsOpen(nextOpen);

    if (!nextOpen) {
      setScope(SUPPORT_USER_SCOPES.ADMINS);
      setSearch("");
      setRoleSlug("");
      setSelectedUserId("");
    }
  };

  const handleScopeChange = (nextScope: string) => {
    const normalizedScope = nextScope as SupportUserScope;

    setScope(normalizedScope);
    setRoleSlug("");
    setSelectedUserId("");
  };

  const handleSearchChange = (nextSearch: string) => {
    setSearch(nextSearch);
    setSelectedUserId("");
  };

  const handleRoleChange = (nextRoleSlug: string) => {
    setRoleSlug(nextRoleSlug === "all" ? "" : nextRoleSlug);
    setSelectedUserId("");
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
          {t("superAdminTenantsView.table.actions.impersonateUser")}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        data-testid={TENANTS_PAGE_HANDLES.SUPPORT_MODE_POPOVER}
        side="bottom"
        align="end"
        sideOffset={10}
        className="w-[min(92vw,24rem)] p-0"
      >
        <Tabs value={scope} onValueChange={handleScopeChange} className="w-full">
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-b-none rounded-t-lg border-b border-input bg-primary-50 p-1">
            <TabsTrigger
              value={SUPPORT_USER_SCOPES.ADMINS}
              data-testid={TENANTS_PAGE_HANDLES.SUPPORT_MODE_ADMINS_TAB}
            >
              {t("superAdminTenantsView.supportModePopover.tabs.admins")}
            </TabsTrigger>
            <TabsTrigger
              value={SUPPORT_USER_SCOPES.ALL}
              data-testid={TENANTS_PAGE_HANDLES.SUPPORT_MODE_ALL_USERS_TAB}
            >
              {t("superAdminTenantsView.supportModePopover.tabs.allUsers")}
            </TabsTrigger>
          </TabsList>
          <Command shouldFilter={false} className="[&_[cmdk-input]]:outline-none">
            <CommandInput
              value={search}
              data-testid={TENANTS_PAGE_HANDLES.SUPPORT_MODE_SEARCH}
              className="outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
              placeholder={t("superAdminTenantsView.supportModePopover.searchPlaceholder")}
              onValueChange={handleSearchChange}
            />
            {scope === SUPPORT_USER_SCOPES.ALL && (
              <div className="border-b border-input p-3 pt-0">
                <Select value={roleSlug || "all"} onValueChange={handleRoleChange}>
                  <SelectTrigger
                    data-testid={TENANTS_PAGE_HANDLES.SUPPORT_MODE_ROLE_FILTER}
                    className="h-9"
                  >
                    <SelectValue
                      placeholder={t("superAdminTenantsView.supportModePopover.roleFilter")}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="all"
                      data-testid={TENANTS_PAGE_HANDLES.supportModeRoleFilterOption("all")}
                    >
                      {t("superAdminTenantsView.supportModePopover.allRoles")}
                    </SelectItem>
                    {roles.map((role) => (
                      <SelectItem
                        key={role.id}
                        value={role.slug}
                        data-testid={TENANTS_PAGE_HANDLES.supportModeRoleFilterOption(role.slug)}
                      >
                        {getRoleLabel(role.slug, t, roles)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isLoadingRoles && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("superAdminTenantsView.supportModePopover.loadingRoles")}
                  </p>
                )}
              </div>
            )}
            <CommandList className="min-h-48">
              <CommandEmpty className="flex min-h-48 items-center justify-center p-4 text-center">
                {isLoading ? (
                  t("superAdminTenantsView.supportModePopover.loading")
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <p>{getEmptyMessage()}</p>
                    {showSearchAllUsers && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        data-testid={TENANTS_PAGE_HANDLES.SUPPORT_MODE_SEARCH_ALL_USERS}
                        onClick={() => handleScopeChange(SUPPORT_USER_SCOPES.ALL)}
                      >
                        {t("superAdminTenantsView.supportModePopover.searchAllUsers")}
                      </Button>
                    )}
                  </div>
                )}
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
                      className="items-start"
                    >
                      <UserAvatar
                        userName={user.label}
                        profilePictureUrl={user.profilePictureUrl}
                        className="mt-0.5 size-8"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-neutral-950">
                          {user.label}
                        </p>
                        {user.roles.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <Badge
                                key={role.id}
                                data-testid={TENANTS_PAGE_HANDLES.supportModeUserRole(
                                  user.id,
                                  role.slug,
                                )}
                                className="px-1.5 py-0.5 text-xs"
                              >
                                {getRoleLabel(role.slug, t, roles)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check className="mt-1 size-4 text-primary-700" />}
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
        </Tabs>
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
