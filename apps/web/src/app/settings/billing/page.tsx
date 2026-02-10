"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Billing has moved under Admin. Redirect so old links and bookmarks still work.
 */
export default function SettingsBillingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/billing");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <p className="text-muted-foreground">Redirecting to Billing…</p>
    </div>
  );
}
