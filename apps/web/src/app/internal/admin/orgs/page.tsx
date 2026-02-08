"use client";

import React, { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { Switch } from "@/components/ui/switch";

export default function SuperAdminOrgsPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [overrideEnabled, setOverrideEnabled] = useState(false);
  const [vesselLimit, setVesselLimit] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [reason, setReason] = useState("");

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled: isSignedIn === true,
    retry: 1,
  });

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ["search-orgs", searchQuery],
    queryFn: () => api.searchOrgs(searchQuery || undefined),
    enabled: isSignedIn === true && me?.user.is_super_admin === true,
  });

  const updateBillingMutation = useMutation({
    mutationFn: (data: {
      orgId: number;
      billing_override_enabled?: boolean;
      billing_override_vessel_limit?: number | null;
      billing_override_expires_at?: string | null;
      billing_override_reason?: string | null;
    }) => {
      const { orgId, ...updateData } = data;
      return api.updateBillingOverride(orgId, updateData);
    },
    onSuccess: () => {
      toast.success("Billing override updated successfully");
      setEditModalOpen(false);
      setSelectedOrg(null);
      queryClient.invalidateQueries({ queryKey: ["search-orgs"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update billing override");
    },
  });

  const handleEdit = (org: any) => {
    setSelectedOrg(org);
    setOverrideEnabled(org.billing_override_enabled || false);
    setVesselLimit(org.billing_override_vessel_limit?.toString() || "");
    setExpiresAt(
      org.billing_override_expires_at
        ? format(new Date(org.billing_override_expires_at), "yyyy-MM-dd'T'HH:mm")
        : ""
    );
    setReason(org.billing_override_reason || "");
    setEditModalOpen(true);
  };

  const handleSave = () => {
    if (!selectedOrg) return;

    const updateData: any = {
      billing_override_enabled: overrideEnabled,
    };

    if (overrideEnabled) {
      if (vesselLimit) {
        updateData.billing_override_vessel_limit = parseInt(vesselLimit) || null;
      } else {
        updateData.billing_override_vessel_limit = null;
      }
      updateData.billing_override_expires_at = expiresAt || null;
      updateData.billing_override_reason = reason || null;
    } else {
      // When disabling, clear all override fields
      updateData.billing_override_vessel_limit = null;
      updateData.billing_override_expires_at = null;
      updateData.billing_override_reason = null;
    }

    updateBillingMutation.mutate({
      orgId: selectedOrg.id,
      ...updateData,
    });
  };

  if (!isSignedIn) {
    router.push("/");
    return null;
  }

  if (meLoading) {
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

  if (isSignedIn && me && !me.user.is_super_admin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Super admin access required
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate effective vessel limit for display
  const getEffectiveVesselLimit = (org: any) => {
    if (org.billing_override_enabled) {
      const now = new Date();
      const expiresAt = org.billing_override_expires_at
        ? new Date(org.billing_override_expires_at)
        : null;
      if (!expiresAt || expiresAt > now) {
        return org.billing_override_vessel_limit ?? "Unlimited";
      }
    }
    return "N/A (no override)";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Organization Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage organization billing overrides
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>

          {orgsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !orgs || orgs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No organizations found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Vessel Count</th>
                    <th className="text-left p-2">Effective Limit</th>
                    <th className="text-left p-2">Override Status</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org: any) => {
                    const effectiveLimit = getEffectiveVesselLimit(org);
                    const overrideActive =
                      org.billing_override_enabled &&
                      (!org.billing_override_expires_at ||
                        new Date(org.billing_override_expires_at) > new Date());

                    return (
                      <tr key={org.id} className="border-b">
                        <td className="p-2">{org.id}</td>
                        <td className="p-2 font-medium">{org.name}</td>
                        <td className="p-2">{org.vessel_count ?? 0}</td>
                        <td className="p-2">{effectiveLimit}</td>
                        <td className="p-2">
                          {overrideActive ? (
                            <Badge variant="default">Active Override</Badge>
                          ) : (
                            <Badge variant="secondary">No Override</Badge>
                          )}
                        </td>
                        <td className="p-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(org)}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit Billing Override - {selectedOrg?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="override-enabled">Enable Billing Override</Label>
              <Switch
                id="override-enabled"
                checked={overrideEnabled}
                onCheckedChange={setOverrideEnabled}
              />
            </div>

            {overrideEnabled && (
              <>
                <div>
                  <Label htmlFor="vessel-limit">Vessel Limit</Label>
                  <Input
                    id="vessel-limit"
                    type="number"
                    placeholder="Leave empty for unlimited"
                    value={vesselLimit}
                    onChange={(e) => setVesselLimit(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Leave empty for unlimited vessels
                  </p>
                </div>

                <div>
                  <Label htmlFor="expires-at">Expires At</Label>
                  <Input
                    id="expires-at"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Leave empty for no expiration
                  </p>
                </div>

                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Reason for billing override..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateBillingMutation.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
