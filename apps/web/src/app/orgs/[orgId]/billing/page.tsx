"use client";

import React from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function OrgBillingPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const params = useParams();
  const api = useApi();
  const orgId = params?.orgId ? parseInt(params.orgId as string) : null;

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled: isSignedIn === true,
    retry: 1,
  });

  const { data: billing, isLoading: billingLoading } = useQuery({
    queryKey: ["org-billing", orgId],
    queryFn: () => api.getOrgBilling(orgId!),
    enabled: isSignedIn === true && orgId !== null,
  });

  if (!isSignedIn) {
    router.push("/");
    return null;
  }

  if (meLoading || billingLoading) {
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
              Billing information not available
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const vesselLimitDisplay =
    billing.vessel_usage.limit === null
      ? "Unlimited"
      : billing.vessel_usage.limit.toString();
  const vesselUsageDisplay = `${billing.vessel_usage.current} / ${vesselLimitDisplay}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Billing & Usage</h1>
        <p className="text-muted-foreground mt-2">
          View your organization's billing and usage information
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
          <CardTitle>Subscription</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">
              {billing.subscription_plan || "No active subscription"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium">
              {billing.subscription_status || "N/A"}
            </span>
          </div>
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
          {billing.vessel_usage.limit !== null && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{
                  width: `${Math.min(
                    (billing.vessel_usage.current / billing.vessel_usage.limit) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Effective Limit</span>
            <span className="font-medium">
              {billing.effective_entitlement.vessel_limit === null
                ? "Unlimited"
                : billing.effective_entitlement.vessel_limit.toString()}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant={
                billing.effective_entitlement.is_active ? "default" : "destructive"
              }
            >
              {billing.effective_entitlement.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
