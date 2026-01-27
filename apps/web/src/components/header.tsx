"use client";

import React from "react";
import Link from "next/link";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { useOrg } from "@/contexts/org-context";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function Header() {
  const { isSignedIn, user } = useUser();
  const { orgId, setOrgId } = useOrg();
  const api = useApi();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled: isSignedIn === true,
  });

  const activeMemberships = me?.memberships.filter((m) => m.status === "ACTIVE") || [];
  const currentOrg = activeMemberships.find((m) => m.org_id === orgId);

  // Auto-select first org if none selected
  React.useEffect(() => {
    if (isSignedIn && !orgId && activeMemberships.length > 0) {
      setOrgId(activeMemberships[0].org_id);
    }
  }, [isSignedIn, orgId, activeMemberships, setOrgId]);

  return (
    <header className="border-b bg-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary">
            vessel-ops
          </Link>
          <nav className="flex items-center gap-4">
            {isSignedIn ? (
              <>
                {activeMemberships.length > 0 && (
                  <Select
                    value={orgId?.toString() || ""}
                    onChange={(e) => {
                      const newOrgId = e.target.value ? parseInt(e.target.value, 10) : null;
                      setOrgId(newOrgId);
                    }}
                    className="w-48"
                  >
                    {activeMemberships.map((m) => (
                      <option key={m.org_id} value={m.org_id.toString()}>
                        {m.org_name} ({m.role})
                      </option>
                    ))}
                  </Select>
                )}
                {me?.user.is_super_admin && (
                  <Link
                    href="/super-admin"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Super Admin
                  </Link>
                )}
                {currentOrg?.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href="/"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Dashboard
                </Link>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <SignInButton mode="modal">
                <Button variant="outline">Sign In</Button>
              </SignInButton>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
