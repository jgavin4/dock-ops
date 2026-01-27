"use client";

import React from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

export default function AdminPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const { orgId } = useOrg();
  const api = useApi();
  const queryClient = useQueryClient();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MANAGER" | "TECH">("TECH");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED">("APPROVED");

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["org-members", orgId],
    queryFn: () => api.listOrgMembers(orgId!),
    enabled: !!orgId && isSignedIn === true,
  });

  const { data: orgRequests, isLoading: orgRequestsLoading } = useQuery({
    queryKey: ["org-requests"],
    queryFn: () => api.listOrgRequests(),
    enabled: isSignedIn === true,
  });

  const createInviteMutation = useMutation({
    mutationFn: (data: { email: string; role: "ADMIN" | "MANAGER" | "TECH" }) =>
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
      role: "ADMIN" | "MANAGER" | "TECH";
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

  const reviewRequestMutation = useMutation({
    mutationFn: ({
      requestId,
      status,
      notes,
    }: {
      requestId: number;
      status: string;
      notes?: string;
    }) => api.reviewOrgRequest(requestId, { status, review_notes: notes }),
    onSuccess: () => {
      toast.success("Organization request reviewed successfully");
      setReviewModalOpen(false);
      setSelectedRequest(null);
      setReviewNotes("");
      queryClient.invalidateQueries({ queryKey: ["org-requests"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to review request");
    },
  });

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

  const getRoleBadgeVariant = (role: string) => {
    if (role === "ADMIN") return "destructive";
    if (role === "MANAGER") return "default";
    return "secondary";
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === "ACTIVE") return "default";
    if (status === "DISABLED") return "destructive";
    return "secondary";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Organization Admin</h1>
        <Button onClick={() => setInviteModalOpen(true)}>Invite Member</Button>
      </div>

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
                          {member.role}
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
                                    role: e.target.value as "ADMIN" | "MANAGER" | "TECH",
                                  })
                                }
                                className="w-32"
                                disabled={updateRoleMutation.isPending}
                              >
                                <option value="ADMIN">ADMIN</option>
                                <option value="MANAGER">MANAGER</option>
                                <option value="TECH">TECH</option>
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

      {/* Organization Requests */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {orgRequestsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !orgRequests || orgRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No pending organization requests.
            </p>
          ) : (
            <div className="space-y-4">
              {orgRequests.map((request: any) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-lg">{request.org_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Requested by: {request.requested_by_name || request.requested_by_email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(request.created_at), "PPp")}
                      </p>
                    </div>
                    <Badge variant="secondary">{request.status}</Badge>
                  </div>
                  {request.status === "PENDING" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setReviewAction("APPROVED");
                          setReviewModalOpen(true);
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setSelectedRequest(request);
                          setReviewAction("REJECTED");
                          setReviewModalOpen(true);
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
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
                    setInviteRole(e.target.value as "ADMIN" | "MANAGER" | "TECH")
                  }
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="MANAGER">MANAGER</option>
                  <option value="TECH">TECH</option>
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

      {/* Review Request Modal */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "APPROVED" ? "Approve" : "Reject"} Organization Request
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">Organization Name:</p>
                <p className="text-lg">{selectedRequest.org_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Requested By:</p>
                <p>
                  {selectedRequest.requested_by_name || selectedRequest.requested_by_email}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Review Notes (optional)
                </label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add any notes about this decision..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setReviewModalOpen(false);
                setSelectedRequest(null);
                setReviewNotes("");
              }}
              disabled={reviewRequestMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={reviewAction === "APPROVED" ? "default" : "destructive"}
              onClick={() => {
                if (selectedRequest) {
                  reviewRequestMutation.mutate({
                    requestId: selectedRequest.id,
                    status: reviewAction,
                    notes: reviewNotes || undefined,
                  });
                }
              }}
              disabled={reviewRequestMutation.isPending}
            >
              {reviewRequestMutation.isPending
                ? "Processing..."
                : reviewAction === "APPROVED"
                ? "Approve"
                : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
