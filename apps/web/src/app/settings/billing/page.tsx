"use client";

import React, { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useOrg } from "@/contexts/org-context";

const PLANS = [
  { id: "starter", name: "Starter", vessels: 3, price: "$29" },
  { id: "standard", name: "Standard", vessels: 5, price: "$49" },
  { id: "pro", name: "Pro", vessels: 10, price: "$99" },
  { id: "unlimited", name: "Unlimited", vessels: "Unlimited", price: "$199" },
];

export default function BillingPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useApi();
  const { orgId } = useOrg();

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

  const checkoutMutation = useMutation({
    mutationFn: (plan: string) => api.createCheckoutSession(plan),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create checkout session");
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => api.createPortalSession(),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to open billing portal");
    },
  });

  // Check for success/canceled params
  useEffect(() => {
    if (searchParams.get("success") === "1") {
      toast.success("Subscription activated successfully!");
      // Refresh billing status
      window.location.href = "/settings/billing";
    }
    if (searchParams.get("canceled") === "1") {
      toast.info("Checkout canceled");
    }
  }, [searchParams]);

  // Check if user is admin
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
          </CardContent>
        </Card>
      </div>
    );
  }

  const vesselLimitDisplay =
    billing.vessel_limit === null ? "Unlimited" : billing.vessel_limit.toString();
  const vesselUsageDisplay = `${billing.vessel_usage.current} / ${vesselLimitDisplay}`;
  const isAtLimit =
    billing.vessel_limit !== null &&
    billing.vessel_usage.current >= billing.vessel_limit;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization's subscription and billing
        </p>
      </div>

      {billing.billing_override.active && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">
                  Billing Override Active
                </h3>
                <p className="text-sm text-blue-800">
                  This organization is currently comped by DockOps
                  {billing.billing_override.expires_at && (
                    <> until {format(new Date(billing.billing_override.expires_at), "PPp")}</>
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
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">
              {billing.plan ? (
                <Badge variant="default">{billing.plan.charAt(0).toUpperCase() + billing.plan.slice(1)}</Badge>
              ) : (
                "No active subscription"
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
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
                "N/A"
              )}
            </span>
          </div>
          {billing.current_period_end && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Renewal Date</span>
              <span className="font-medium">
                {format(new Date(billing.current_period_end), "PPp")}
              </span>
            </div>
          )}
          {billing.status && (
            <div className="pt-4">
              <Button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                variant="outline"
              >
                {portalMutation.isPending ? "Loading..." : "Manage Billing"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vessel Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Usage</span>
            <span className="font-medium">{vesselUsageDisplay}</span>
          </div>
          {billing.vessel_limit !== null && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${
                  isAtLimit ? "bg-red-600" : "bg-blue-600"
                }`}
                style={{
                  width: `${Math.min(
                    (billing.vessel_usage.current / billing.vessel_limit) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          )}
          {isAtLimit && (
            <p className="text-sm text-destructive">
              Vessel limit reached. Upgrade your plan to add more vessels.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => {
              const isCurrentPlan = billing.plan === plan.id;
              const isUpgrade =
                billing.plan &&
                !isCurrentPlan &&
                (plan.id === "unlimited" ||
                  (billing.vessel_limit !== null &&
                    plan.vessels !== "Unlimited" &&
                    typeof plan.vessels === "number" &&
                    plan.vessels > billing.vessel_limit));

              return (
                <Card
                  key={plan.id}
                  className={
                    isCurrentPlan ? "border-primary border-2" : ""
                  }
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <div className="text-2xl font-bold">{plan.price}</div>
                    <div className="text-sm text-muted-foreground">
                      {plan.vessels === "Unlimited"
                        ? "Unlimited vessels"
                        : `${plan.vessels} vessels`}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {isCurrentPlan ? (
                      <Badge variant="default" className="w-full justify-center">
                        Current Plan
                      </Badge>
                    ) : (
                      <Button
                        variant={isUpgrade ? "default" : "outline"}
                        className="w-full"
                        onClick={() => checkoutMutation.mutate(plan.id)}
                        disabled={checkoutMutation.isPending}
                      >
                        {checkoutMutation.isPending
                          ? "Loading..."
                          : isUpgrade
                          ? "Upgrade"
                          : "Change Plan"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
