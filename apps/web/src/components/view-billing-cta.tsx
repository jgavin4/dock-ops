"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

export function ViewBillingCta() {
  const { isSignedIn } = useUser();

  const buttonClass =
    "inline-flex items-center justify-center rounded-md text-sm font-medium h-10 py-2 px-4 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

  return (
    <div className="text-center">
      {isSignedIn ? (
        <Link href="/admin/billing" className={buttonClass} id="view-billing-btn">
          View Billing
        </Link>
      ) : (
        <Link href="/sign-up" className={buttonClass} id="view-billing-btn">
          Get Started
        </Link>
      )}
      <p className="text-xs text-muted-foreground mt-2">
        {isSignedIn
          ? "Manage your plan and billing in settings."
          : "Sign in to manage billing and upgrade your plan."}
      </p>
    </div>
  );
}
