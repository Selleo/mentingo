import { Link } from "@remix-run/react";
import { useState } from "react";

import { useTenants } from "~/api/queries/super-admin/useTenants";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

export default function TenantsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useTenants({ page: 1, perPage: 50, search });

  return (
    <PageWrapper>
      <div className="flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Tenants</h1>
            <p className="text-sm text-muted-foreground">
              Manage tenant names, domains, status, and managing flags.
            </p>
          </div>
          <Button asChild>
            <Link to="/super-admin/tenants/new">Create Tenant</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Search tenants..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <div className="rounded-md border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Host</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Managing</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    Loading tenants...
                  </td>
                </tr>
              )}
              {!isLoading && data?.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No tenants found.
                  </td>
                </tr>
              )}
              {data?.data?.map((tenant) => (
                <tr key={tenant.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{tenant.name}</td>
                  <td className="px-4 py-3">{tenant.host}</td>
                  <td className="px-4 py-3 capitalize">{tenant.status}</td>
                  <td className="px-4 py-3">{tenant.isManaging ? "Yes" : "No"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/super-admin/tenants/${tenant.id}`}>Edit</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
