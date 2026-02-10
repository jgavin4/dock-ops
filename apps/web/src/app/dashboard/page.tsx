"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { useOrg } from "@/contexts/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImportDialog } from "@/components/import-dialog";
import Link from "next/link";

function AddVesselDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    make: null as string | null,
    model: null as string | null,
    year: null as number | null,
    description: null as string | null,
    location: null as string | null,
  });
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (!open) {
      setFormData({
        name: "",
        make: null,
        model: null,
        year: null,
        description: null,
        location: null,
      });
      setErrors({});
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrors({ name: "Name is required" });
      return;
    }
    onCreate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Vessel</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                placeholder="Vessel name"
                required
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Make</label>
              <Input
                value={formData.make || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    make: e.target.value || null,
                  })
                }
                placeholder="Manufacturer"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Model</label>
              <Input
                value={formData.model || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    model: e.target.value || null,
                  })
                }
                placeholder="Model"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Year</label>
              <Input
                type="number"
                value={formData.year || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    year: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="Year"
                min="1900"
                max="2100"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Location</label>
              <Input
                value={formData.location || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    location: e.target.value || null,
                  })
                }
                placeholder="Location"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Description
              </label>
              <Textarea
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    description: e.target.value || null,
                  })
                }
                placeholder="Description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create Vessel</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VesselCard({ vessel }: { vessel: any }) {
  const makeModelYear = [
    vessel.make,
    vessel.model,
    vessel.year?.toString(),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-xl">{vessel.name}</CardTitle>
        {makeModelYear && (
          <p className="text-sm text-muted-foreground">{makeModelYear}</p>
        )}
        {vessel.location && (
          <p className="text-sm text-muted-foreground">📍 {vessel.location}</p>
        )}
      </CardHeader>
      <CardContent>
        <Link href={`/vessels/${vessel.id}`}>
          <Button variant="outline" className="w-full">
            View
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const { orgId } = useOrg();
  const api = useApi();
  const queryClient = useQueryClient();
  const [addVesselOpen, setAddVesselOpen] = useState(false);
  const [importVesselOpen, setImportVesselOpen] = useState(false);

  const { data: me, isLoading: meLoading, error: meError } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled: isSignedIn === true,
    retry: 1,
  });

  // Redirect to onboarding if no orgs
  useEffect(() => {
    if (isLoaded && isSignedIn && me) {
      const activeOrgs = me.memberships.filter((m) => m.status === "ACTIVE");
      if (activeOrgs.length === 0) {
        router.push("/onboarding");
      }
    }
  }, [isLoaded, isSignedIn, me, router]);

  const { data: vessels, isLoading, error } = useQuery({
    queryKey: ["vessels", orgId],
    queryFn: () => api.listVessels(),
    enabled: !!orgId && isSignedIn === true,
  });

  const { data: billing } = useQuery({
    queryKey: ["billing-status"],
    queryFn: () => api.getBillingStatus(),
    enabled: !!orgId && isSignedIn === true,
  });

  // Use effective limit (from entitlement; respects override)
  const effectiveLimit = billing?.vessel_usage?.limit ?? billing?.effective_vessel_limit ?? billing?.vessel_limit;
  const canAddVessel = useMemo(() => {
    if (!billing) return true; // Allow if billing data not loaded yet
    if (effectiveLimit === null) return true; // Unlimited
    return billing.vessel_usage.current < effectiveLimit;
  }, [billing, effectiveLimit]);

  const createVesselMutation = useMutation({
    mutationFn: (data: any) => api.createVessel(data),
    onSuccess: () => {
      toast.success("Vessel created successfully");
      queryClient.invalidateQueries({ queryKey: ["vessels", orgId] });
      setAddVesselOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create vessel");
    },
  });

  if (!isLoaded || (isSignedIn && meLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSignedIn && meError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Error loading user data: {meError instanceof Error ? meError.message : "Unknown error"}
            </p>
            <p className="text-center text-sm text-muted-foreground mt-2">
              Please check your connection and try refreshing the page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSignedIn && !me) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">Loading user data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSignedIn && !orgId && me) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center">Loading organization...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please sign in to view vessels
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2 mt-2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-10 bg-muted rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">
            Error loading vessels: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentMembership = me?.memberships?.find((m) => m.org_id === orgId);
  const isAdmin = currentMembership?.role === "ADMIN";
  const atVesselLimit = billing && effectiveLimit !== null && billing.vessel_usage.current >= effectiveLimit;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Vessels</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportVesselOpen(true)}>
            Import
          </Button>
          <Button 
            onClick={() => setAddVesselOpen(true)}
            disabled={!canAddVessel}
            title={
              !canAddVessel
                ? "Vessel limit reached. Add more vessel packs in Billing to increase your limit."
                : ""
            }
          >
            Add Vessel
          </Button>
        </div>
      </div>

      {atVesselLimit && isAdmin && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="pt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-amber-900">
              You&apos;ve reached your vessel limit. Add more vessel packs in Billing to allow additional vessels.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/billing">Manage Billing</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {vessels && vessels.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vessels.map((vessel) => (
            <VesselCard key={vessel.id} vessel={vessel} />
          ))}
        </div>
      ) : (
        <Card className="py-12">
          <CardContent className="text-center">
            <p className="text-lg text-muted-foreground mb-4">
              No vessels yet
            </p>
            <Button
              onClick={() => setAddVesselOpen(true)}
              disabled={!canAddVessel}
              title={
                !canAddVessel
                  ? "Vessel limit reached. Add more vessel packs in Billing."
                  : ""
              }
            >
              Add your first vessel
            </Button>
          </CardContent>
        </Card>
      )}

      <AddVesselDialog
        open={addVesselOpen}
        onOpenChange={setAddVesselOpen}
        onCreate={(data) => createVesselMutation.mutate(data)}
      />
      <ImportDialog
        open={importVesselOpen}
        onOpenChange={setImportVesselOpen}
        title="Import vessels"
        description="Upload a CSV or Excel file with vessel data. Columns: name, make, model, year, description, location."
        exampleColumns={["name", "make", "model", "year", "description", "location"]}
        onImport={(file) => api.importVessels(file)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["vessels", orgId] });
          setImportVesselOpen(false);
        }}
      />
    </div>
  );
}
