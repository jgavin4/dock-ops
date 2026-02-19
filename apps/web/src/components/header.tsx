"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { useOrg } from "@/contexts/org-context";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sheet, SheetHeader, SheetTitle, SheetContent } from "@/components/ui/sheet";

export function Header() {
  const pathname = usePathname();
  const { isSignedIn, user } = useUser();
  const { orgId, setOrgId } = useOrg();
  const api = useApi();

  const isPublicLanding = pathname === "/";

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled: isSignedIn === true,
  });

  const activeMemberships = React.useMemo(() => {
    return me?.memberships?.filter((m) => m.status === "ACTIVE") || [];
  }, [me?.memberships]);
  
  const currentOrg = React.useMemo(() => {
    return activeMemberships.find((m) => m.org_id === orgId);
  }, [activeMemberships, orgId]);

  // Auto-select first org if none selected, or validate/clear invalid orgId
  React.useEffect(() => {
    if (!isSignedIn || !me) return;
    
    if (activeMemberships.length === 0) {
      // No active memberships - clear orgId
      if (orgId !== null) {
        setOrgId(null);
      }
      return;
    }
    
    // If orgId is set but not in active memberships, clear it
    if (orgId !== null && !activeMemberships.some(m => m.org_id === orgId)) {
      console.warn(`Invalid orgId ${orgId} in localStorage, clearing and selecting first available org`);
      setOrgId(null);
    }
    
    // Auto-select first org if none selected
    if (!orgId && activeMemberships.length > 0 && activeMemberships[0]?.org_id) {
      setOrgId(activeMemberships[0].org_id);
    }
  }, [isSignedIn, orgId, activeMemberships, setOrgId, me]);

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Image
              src="/assets/logo.png"
              alt="DockOps Logo"
              width={120}
              height={40}
              className="h-8 w-auto sm:h-10"
              priority
            />
          </Link>
          <div className="sm:hidden flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
            {isSignedIn ? (
              <UserButton afterSignOutUrl="/" />
            ) : (
              <SignInButton mode="modal">
                <Button variant="outline" size="sm">Sign In</Button>
              </SignInButton>
            )}
          </div>
          <nav className="hidden sm:flex items-center gap-2 sm:gap-4 flex-1 justify-end min-w-0">
            {isPublicLanding && (
              <>
                <a href="/#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
                  Features
                </a>
                <a href="/#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
                  Pricing
                </a>
                <a href="/#contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
                  Contact
                </a>
              </>
            )}
            {isSignedIn ? (
              <>
                {!isPublicLanding && activeMemberships.length > 0 && (
                  <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1 sm:flex-initial max-w-full sm:max-w-none">
                    <Select
                      value={orgId?.toString() || ""}
                      onChange={(e) => {
                        try {
                          const newOrgId = e.target.value ? parseInt(e.target.value, 10) : null;
                          if (newOrgId && !isNaN(newOrgId)) {
                            setOrgId(newOrgId);
                          } else if (!e.target.value) {
                            setOrgId(null);
                          }
                        } catch (error) {
                          console.error("Error updating org selection:", error);
                        }
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
                <div className="flex items-center gap-4">
                  {!isPublicLanding && me?.user.is_super_admin && (
                    <Link
                      href="/super-admin"
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      Super Admin
                    </Link>
                  )}
                  {!isPublicLanding && currentOrg?.role === "ADMIN" && (
                    <Link
                      href="/admin"
                      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    href="/dashboard"
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
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetHeader className="flex-row items-center justify-between space-y-0">
          <SheetTitle>Menu</SheetTitle>
          <Button variant="ghost" size="sm" onClick={closeMobileMenu} aria-label="Close menu">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Button>
        </SheetHeader>
        <SheetContent className="flex flex-col gap-4">
          {isPublicLanding && (
            <>
              <a href="/#features" className="text-base font-medium py-2" onClick={closeMobileMenu}>
                Features
              </a>
              <a href="/#pricing" className="text-base font-medium py-2" onClick={closeMobileMenu}>
                Pricing
              </a>
              <a href="/#contact" className="text-base font-medium py-2" onClick={closeMobileMenu}>
                Contact
              </a>
            </>
          )}
          {isSignedIn && (
            <>
              {activeMemberships.length > 0 && !isPublicLanding && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Organization</label>
                  <Select
                    value={orgId?.toString() || ""}
                    onChange={(e) => {
                      try {
                        const newOrgId = e.target.value ? parseInt(e.target.value, 10) : null;
                        if (newOrgId && !isNaN(newOrgId)) {
                          setOrgId(newOrgId);
                        } else if (!e.target.value) {
                          setOrgId(null);
                        }
                      } catch (error) {
                        console.error("Error updating org selection:", error);
                      }
                    }}
                    className="w-full text-sm"
                  >
                    {activeMemberships.map((m) => (
                      <option key={m.org_id} value={m.org_id.toString()}>
                        {m.org_name} ({m.role})
                      </option>
                    ))}
                  </Select>
                  <Link
                    href="/onboarding"
                    className="text-sm text-muted-foreground hover:text-foreground inline-block py-1"
                    onClick={closeMobileMenu}
                  >
                    + Add organization
                  </Link>
                </div>
              )}
              <Link href="/dashboard" className="text-base font-medium py-2 block" onClick={closeMobileMenu}>
                Dashboard
              </Link>
              {currentOrg?.role === "ADMIN" && (
                <Link href="/admin" className="text-base font-medium py-2 block" onClick={closeMobileMenu}>
                  Admin
                </Link>
              )}
              {me?.user.is_super_admin && (
                <Link href="/super-admin" className="text-base font-medium py-2 block" onClick={closeMobileMenu}>
                  Super Admin
                </Link>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </header>
  );
}
