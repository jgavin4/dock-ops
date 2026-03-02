"use client";

import React from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import { useOrg } from "@/contexts/org-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function AdminPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const { orgId } = useOrg();
  const api = useApi();
  const queryClient = useQueryClient();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"OWNER" | "CAPTAIN" | "CREW">("CREW");

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["org-members", orgId, isLoaded, isSignedIn],
    queryFn: () => api.listOrgMembers(orgId!),
    enabled: isLoaded === true && isSignedIn === true && !!orgId,
  });


  const createInviteMutation = useMutation({
    mutationFn: (data: { email: string; role: "OWNER" | "CAPTAIN" | "CREW" }) =>
      api.createOrgInvite(orgId!, data),
    onSuccess: () => {
      toast.success("Invitation sent successfully");
      setInviteModalOpen(false);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: number;
      role: "OWNER" | "CAPTAIN" | "CREW";
    }) => api.updateMemberRole(orgId!, userId, { role }),
    onSuccess: () => {
      toast.success("Role updated successfully");
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  const disableMemberMutation = useMutation({
    mutationFn: (userId: number) => api.disableMember(orgId!, userId),
    onSuccess: () => {
      toast.success("Member disabled successfully");
      queryClient.invalidateQueries({ queryKey: ["org-members", orgId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to disable member");
    },
  });

  if (!isLoaded) {
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

  if (!isSignedIn) {
    router.push("/");
    return null;
  }

  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Please select an organization
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    createInviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const formatRole = (role: string) => {
    if (role === "OWNER") return "Owner";
    if (role === "CAPTAIN") return "Captain";
    if (role === "CREW") return "Crew";
    return role;
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === "OWNER") return "destructive";
    if (role === "CAPTAIN") return "default";
    return "secondary";
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === "ACTIVE") return "default";
    if (status === "DISABLED") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold">Organization Admin</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Admin:</span>
          <Link
            href="/admin"
            className="text-sm font-medium text-foreground underline underline-offset-4"
          >
            Members
          </Link>
          <span className="text-sm text-muted-foreground">|</span>
          <Link
            href="/admin/billing"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Billing
          </Link>
        </div>
        <Button onClick={() => setInviteModalOpen(true)}>Invite Member</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing & subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm mb-4">
            Manage your subscription, add boats, and view usage.
          </p>
          <Link
            href="/admin/billing"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Billing & subscription
          </Link>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !members || members.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No members yet. Invite someone to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">User</th>
                    <th className="text-left p-2">Role</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="border-b">
                      <td className="p-2">
                        <div>
                          <p className="font-medium">
                            {member.user_name || member.user_email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {member.user_email}
                          </p>
                        </div>
                      </td>
                      <td className="p-2">
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {formatRole(member.role)}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge variant={getStatusBadgeVariant(member.status)}>
                          {member.status}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          {member.status === "ACTIVE" && (
                            <>
                              <Select
                                value={member.role}
                                onChange={(e) =>
                                  updateRoleMutation.mutate({
                                    userId: member.user_id,
                                    role: e.target.value as "OWNER" | "CAPTAIN" | "CREW",
                                  })
                                }
                                className="w-32"
                                disabled={updateRoleMutation.isPending}
                              >
                                <option value="OWNER">Owner</option>
                                <option value="CAPTAIN">Captain</option>
                                <option value="CREW">Crew</option>
                              </Select>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  disableMemberMutation.mutate(member.user_id)
                                }
                                disabled={disableMemberMutation.isPending}
                              >
                                Disable
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Email *</label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Role *</label>
                <Select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as "OWNER" | "CAPTAIN" | "CREW")
                  }
                >
                  <option value="OWNER">Owner</option>
                  <option value="CAPTAIN">Captain</option>
                  <option value="CREW">Crew</option>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteModalOpen(false)}
                disabled={createInviteMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createInviteMutation.isPending}>
                {createInviteMutation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
