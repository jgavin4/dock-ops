"use client";

import React from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOrg } from "@/contexts/org-context";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function OnboardingPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const api = useApi();
  const { setOrgId } = useOrg();
  const [orgName, setOrgName] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [activeTab, setActiveTab] = useState<"create" | "invite">("create");
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [pendingOrgName, setPendingOrgName] = useState("");

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled: isSignedIn === true,
  });

  const createOrgRequestMutation = useMutation({
    mutationFn: (name: string) => api.createOrgRequest({ org_name: name }),
    onSuccess: () => {
      toast.success("Organization request submitted! An admin will review it shortly.");
      // Refetch me to check for new memberships
      setTimeout(() => {
        router.refresh();
      }, 2000);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit organization request");
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) => 
      api.createOrg({ name, force: force || false }),
    onSuccess: (org) => {
      toast.success(`Organization "${org.name}" created successfully!`);
      setDuplicateConfirmOpen(false);
      setPendingOrgName("");
      // Refetch me to check for new memberships
      setTimeout(() => {
        router.refresh();
      }, 1000);
    },
    onError: (error: any) => {
      // Check if it's a 409 Conflict (duplicate name)
      if (error?.response?.status === 409) {
        setPendingOrgName(orgName);
        setDuplicateConfirmOpen(true);
      } else {
        toast.error(error.message || "Failed to create organization");
      }
    },
  });

  const acceptInviteMutation = useMutation({
    mutationFn: (token: string) => api.acceptInvite({ token }),
    onSuccess: (membership) => {
      toast.success("Invite accepted successfully!");
      setOrgId(membership.org_id);
      router.push("/");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to accept invite");
    },
  });

  // Note: We allow users to access onboarding even if they have orgs
  // so they can create or join additional organizations

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please sign in to continue
            </p>
          </CardContent>
        </Card>
      </div>
    );
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

  // Show onboarding page even if user has orgs - they might want more

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast.error("Organization name is required");
      return;
    }
    // Super admins can create orgs directly, others need to request
    if (me?.user.is_super_admin) {
      createOrgMutation.mutate({ name: orgName.trim() });
    } else {
      createOrgRequestMutation.mutate(orgName.trim());
    }
  };

  const handleAcceptInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim()) {
      toast.error("Invite code is required");
      return;
    }
    acceptInviteMutation.mutate(inviteToken.trim());
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {me && me.memberships.length > 0 ? "Add Organization" : "Get Started"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "create" | "invite")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="create">Create Organization</TabsTrigger>
              <TabsTrigger value="invite">Use Invite Code</TabsTrigger>
            </TabsList>
            
            <TabsContent value="create" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Request to create a new organization. An admin will review your request and approve it.
              </p>
              <form onSubmit={handleCreateRequest}>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Organization Name *
                    </label>
                    <Input
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g., Marina Bay Yacht Club"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={me?.user.is_super_admin ? createOrgMutation.isPending : createOrgRequestMutation.isPending}
                  >
                    {me?.user.is_super_admin
                      ? createOrgMutation.isPending
                        ? "Creating..."
                        : "Create Organization"
                      : createOrgRequestMutation.isPending
                      ? "Submitting..."
                      : "Submit Request"}
                  </Button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="invite" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Enter an invite code to join an existing organization.
              </p>
              <form onSubmit={handleAcceptInvite}>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Invite Code *
                    </label>
                    <Input
                      value={inviteToken}
                      onChange={(e) => setInviteToken(e.target.value)}
                      placeholder="Enter invite code"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={acceptInviteMutation.isPending}
                  >
                    {acceptInviteMutation.isPending ? "Accepting..." : "Accept Invite"}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Duplicate Confirmation Dialog */}
      <Dialog open={duplicateConfirmOpen} onOpenChange={setDuplicateConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Organization Name Already Exists</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You have already created or are a member of an organization named "{pendingOrgName}".
              Do you want to create another organization with this name?
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDuplicateConfirmOpen(false);
                setPendingOrgName("");
              }}
              disabled={createOrgMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (pendingOrgName) {
                  createOrgMutation.mutate({ name: pendingOrgName, force: true });
                }
              }}
              disabled={createOrgMutation.isPending}
            >
              {createOrgMutation.isPending ? "Creating..." : "Create Anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
