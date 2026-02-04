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
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="text-xl sm:text-2xl font-bold text-primary whitespace-nowrap">
            vessel-ops
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4 flex-1 justify-end min-w-0">
            {isSignedIn ? (
              <>
                {activeMemberships.length > 0 && (
                  <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 sm:flex-initial max-w-full sm:max-w-none">
                    <Select
                      value={orgId?.toString() || ""}
                      onChange={(e) => {
                        const newOrgId = e.target.value ? parseInt(e.target.value, 10) : null;
                        setOrgId(newOrgId);
                      }}
                      className="w-full sm:w-48 text-sm min-w-0"
                    >
                      {activeMemberships.map((m) => (
                        <option key={m.org_id} value={m.org_id.toString()}>
                          {m.org_name} ({m.role})
                        </option>
                      ))}
                    </Select>
                    <Link
                      href="/onboarding"
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0"
                      title="Create or join another organization"
                    >
                      + Add
                    </Link>
                  </div>
                )}
                <div className="hidden sm:flex items-center gap-4">
                  {me?.user.is_super_admin && (
                    <Link
                      href="/super-admin"
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      Super Admin
                    </Link>
                  )}
                  {currentOrg?.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    href="/"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                  >
                    Dashboard
                  </Link>
                </div>
                <UserButton afterSignOutUrl="/" />
              </>
            ) : (
              <SignInButton mode="modal">
                <Button variant="outline" className="text-sm sm:text-base">Sign In</Button>
              </SignInButton>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
