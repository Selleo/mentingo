import { useQuery } from "@tanstack/react-query";
import { Users, X } from "lucide-react";
import { useState } from "react";

import { ApiClient } from "~/api/api-client";
import { useAuthStore } from "~/modules/Auth/authStore";

// Dev-only tool: strings are not translated on purpose. The endpoints are excluded from Swagger,
// so they are called through the shared axios instance instead of the generated client.
type DevUser = { id: string; email: string; firstName: string; lastName: string; roles: string };

const OPEN_STORAGE_KEY = "dev-user-switcher-open";

const readOpen = () => {
  try {
    return localStorage.getItem(OPEN_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

// A user with several roles lands in one combined group (e.g. "admin, student"), so it is listed once.
export const groupByRoles = (devUsers: DevUser[]) => {
  const groups = new Map<string, DevUser[]>();
  for (const user of devUsers) {
    const key = user.roles || "no role";
    groups.set(key, [...(groups.get(key) ?? []), user]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
};

export function DevUserSwitcher() {
  const [isOpen, setIsOpen] = useState(readOpen);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // 404 when DEV_USER_SWITCHER is off on the API: the widget then renders nothing.
  const { data: devUsers } = useQuery({
    queryKey: ["dev-user-switcher"],
    queryFn: async () =>
      (await ApiClient.instance.get<{ data: DevUser[] }>("/api/dev/users")).data.data,
    retry: false,
    staleTime: Infinity,
  });

  if (!devUsers) return null;

  const toggle = (value: boolean) => {
    setIsOpen(value);
    try {
      localStorage.setItem(OPEN_STORAGE_KEY, String(value));
    } catch {
      // Remembering the panel state is a convenience only.
    }
  };

  const loginAs = async (userId: string) => {
    setPendingId(userId);
    try {
      await ApiClient.instance.post(`/api/dev/users/${userId}/login`);
      useAuthStore.getState().setLoggedIn(true);
      window.location.assign("/");
    } catch {
      setPendingId(null);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-label="Open dev user switcher"
        onClick={() => toggle(true)}
        className="fixed bottom-4 right-4 z-[99] flex size-10 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg hover:bg-neutral-700"
      >
        <Users className="size-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[99] flex max-h-[60vh] w-80 flex-col rounded-lg border border-neutral-300 bg-white text-sm shadow-xl">
      <div className="flex items-center justify-between border-b border-neutral-200 px-3 py-2">
        <span className="font-semibold">Log in as… ({devUsers.length})</span>
        <button type="button" aria-label="Close dev user switcher" onClick={() => toggle(false)}>
          <X className="size-4" />
        </button>
      </div>
      <div className="overflow-y-auto p-1">
        {groupByRoles(devUsers).map(([roles, roleUsers]) => (
          <section key={roles}>
            <h3 className="sticky top-0 mt-1 rounded bg-neutral-900 px-2 py-1 text-xs font-bold uppercase tracking-wide text-white">
              {roles}
            </h3>
            <ul>
              {roleUsers.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    disabled={pendingId !== null}
                    onClick={() => loginAs(user.id)}
                    className="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-neutral-100 disabled:opacity-50"
                  >
                    <span className="font-medium">
                      {user.firstName} {user.lastName}
                    </span>
                    <span className="text-xs text-neutral-500">{user.email}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
