import { Link } from "@remix-run/react";

import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";

export default function TenantInactivePage() {
  return (
    <PageWrapper>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">Tenant Disabled</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          This tenant is currently inactive. Please contact your administrator or try again later.
        </p>
        <Button asChild variant="outline">
          <Link to="/auth/login">Back to Login</Link>
        </Button>
      </div>
    </PageWrapper>
  );
}
