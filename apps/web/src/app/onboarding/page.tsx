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

export default function OnboardingPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const api = useApi();
  const { setOrgId } = useOrg();
  const [orgName, setOrgName] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [activeTab, setActiveTab] = useState<"create" | "invite">("create");

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

  // Redirect if user has orgs
  React.useEffect(() => {
    if (me && me.memberships.length > 0) {
      router.push("/");
    }
  }, [me, router]);

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

  if (me && me.memberships.length > 0) {
    return null; // Will redirect
  }

  const handleCreateRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      toast.error("Organization name is required");
      return;
    }
    createOrgRequestMutation.mutate(orgName.trim());
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
          <CardTitle>Get Started</CardTitle>
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
                    disabled={createOrgRequestMutation.isPending}
                  >
                    {createOrgRequestMutation.isPending ? "Submitting..." : "Submit Request"}
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
    </div>
  );
}
