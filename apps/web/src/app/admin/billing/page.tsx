"use client";

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useOrg } from "@/contexts/org-context";

const BASE_PRICE_DISPLAY = 19;
const PACK_PRICE_DISPLAY = 10;

export default function AdminBillingPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useApi();
  const queryClient = useQueryClient();
  const { orgId } = useOrg();
  const [packQuantity, setPackQuantity] = useState(0);

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled: isSignedIn === true,
  });

  const { data: billing, isLoading: billingLoading } = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => api.getBillingStatus(),
    enabled: isSignedIn === true && orgId !== null,
  });

  useEffect(() => {
    if (billing?.addon_pack_quantity !== undefined) {
      setPackQuantity(billing.addon_pack_quantity);
    }
  }, [billing?.addon_pack_quantity]);

  const checkoutMutation = useMutation({
    mutationFn: (pack_quantity: number) => api.createCheckoutSession(pack_quantity),
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create checkout session");
    },
  });

  const updatePacksMutation = useMutation({
    mutationFn: (pack_quantity: number) => api.updateVesselPacks(pack_quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-status"] });
      toast.success("Vessel packs updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update vessel packs");
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => api.createPortalSession(),
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to open billing portal");
    },
  });

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      toast.success("Subscription activated successfully!");
      window.location.href = "/admin/billing";
    }
    if (searchParams.get("canceled") === "1") {
      toast.info("Checkout canceled");
    }
  }, [searchParams]);

  const currentMembership = me?.memberships?.find((m) => m.org_id === orgId);
  const isAdmin = currentMembership?.role === "ADMIN";

  if (!isSignedIn) {
    router.push("/");
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Admin access required to manage billing
            </p>
            <p className="text-center mt-4">
              <Link href="/admin" className="text-sm text-primary hover:underline">
                Back to Admin
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (billingLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Unable to load billing information
            </p>
            <Link href="/admin" className="text-sm text-primary hover:underline block text-center mt-4">
              Back to Admin
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const baseVessels = billing.base_vessels_included ?? 3;
  const vesselsPerPack = billing.vessels_per_pack ?? 5;
  const effectiveLimit = billing.vessel_usage?.limit ?? billing.effective_vessel_limit ?? null;
  const vesselLimitDisplay = effectiveLimit === null ? "Unlimited" : String(effectiveLimit);
  const vesselUsageDisplay = `${billing.vessel_usage.current} / ${vesselLimitDisplay}`;
  const isAtLimit =
    effectiveLimit !== null && billing.vessel_usage.current >= effectiveLimit;
  const hasSubscription = billing.status === "active" || billing.status === "trialing";
  const overrideActive = billing.billing_override?.active ?? false;
  const canEditPacks = !overrideActive;
  const estimatedTotal = BASE_PRICE_DISPLAY + packQuantity * PACK_PRICE_DISPLAY;
  const hasStripeCustomer = !!billing.plan || hasSubscription;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Members
          </Link>
          <span className="text-sm text-muted-foreground">|</span>
          <span className="text-sm font-medium text-foreground">Billing</span>
        </div>
      </div>
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization&apos;s subscription and billing
        </p>
      </div>

      {overrideActive && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">
                  Billing Override Active
                </h3>
                <p className="text-sm text-blue-800">
                  This organization is comped by DockOps
                  {billing.billing_override?.expires_at ? (
                    <> until {format(new Date(billing.billing_override.expires_at), "PPp")}</>
                  ) : (
                    ""
                  )}
                  .
                </p>
              </div>
              <Badge variant="default">Override Active</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subscription status</span>
            <span className="font-medium">
              {billing.status ? (
                <Badge
                  variant={
                    billing.status === "active" || billing.status === "trialing"
                      ? "default"
                      : "destructive"
                  }
                >
                  {billing.status}
                </Badge>
              ) : (
                "No active subscription"
              )}
            </span>
          </div>
          {billing.current_period_end && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Next renewal date</span>
              <span className="font-medium">
                {format(new Date(billing.current_period_end), "PPp")}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vessel usage</span>
            <span className="font-medium">{vesselUsageDisplay}</span>
          </div>
          {effectiveLimit !== null && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${
                  isAtLimit ? "bg-red-600" : "bg-blue-600"
                }`}
                style={{
                  width: `${Math.min(
                    (billing.vessel_usage.current / effectiveLimit) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          )}
          {isAtLimit && (
            <p className="text-sm text-destructive">
              Vessel limit reached. Add more vessel packs to increase your limit.
            </p>
          )}
          {hasStripeCustomer && (
            <Button
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              variant="outline"
            >
              {portalMutation.isPending ? "Loading..." : "Manage billing"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Base: $19/mo includes 3 vessels.
          </p>
          <p className="text-sm text-muted-foreground">
            Add-ons: +$10/mo per +5 vessels.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-muted-foreground">Vessel packs</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canEditPacks || packQuantity <= 0}
                onClick={() => setPackQuantity((q) => Math.max(0, q - 1))}
              >
                −
              </Button>
              <span className="font-medium min-w-[2rem] text-center">
                {packQuantity}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canEditPacks}
                onClick={() => setPackQuantity((q) => q + 1)}
              >
                +
              </Button>
            </div>
            <span className="text-muted-foreground">
              Total allowed vessels: {baseVessels + packQuantity * vesselsPerPack}
            </span>
          </div>
          <p className="text-sm font-medium">
            Estimated monthly total: ${estimatedTotal}/mo
          </p>
          <p className="text-xs text-muted-foreground">
            Final price confirmed at checkout.
          </p>
        </CardContent>
      </Card>

      {canEditPacks && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {!hasSubscription ? (
              <Button
                onClick={() => checkoutMutation.mutate(packQuantity)}
                disabled={checkoutMutation.isPending}
              >
                {checkoutMutation.isPending ? "Loading..." : "Start subscription"}
              </Button>
            ) : (
              <Button
                onClick={() => updatePacksMutation.mutate(packQuantity)}
                disabled={
                  updatePacksMutation.isPending ||
                  packQuantity === billing.addon_pack_quantity
                }
              >
                {updatePacksMutation.isPending
                  ? "Updating..."
                  : "Update vessel packs"}
              </Button>
            )}
            {hasStripeCustomer && (
              <Button
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? "Loading..." : "Manage billing"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
