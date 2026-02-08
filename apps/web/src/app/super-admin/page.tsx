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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

export default function SuperAdminPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("orgs");
  const [createOrgModalOpen, setCreateOrgModalOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [duplicateConfirmOpen, setDuplicateConfirmOpen] = useState(false);
  const [pendingOrgName, setPendingOrgName] = useState("");

  const { data: me, isLoading: meLoading, error: meError } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled: isSignedIn === true,
    retry: 1,
  });

  const { data: orgs, isLoading: orgsLoading } = useQuery({
    queryKey: ["all-orgs"],
    queryFn: () => api.listAllOrgs(),
    enabled: isSignedIn === true && me?.user.is_super_admin === true,
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: () => api.listAllUsers(),
    enabled: isSignedIn === true && me?.user.is_super_admin === true,
  });

  const { data: orgRequests, isLoading: orgRequestsLoading } = useQuery({
    queryKey: ["all-org-requests"],
    queryFn: () => api.listAllOrgRequests(),
    enabled: isSignedIn === true && me?.user.is_super_admin === true,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (orgId: number) => api.toggleOrgStatus(orgId),
    onSuccess: (org) => {
      toast.success(
        `Organization "${org.name}" has been ${org.is_active ? "enabled" : "disabled"}`
      );
      queryClient.invalidateQueries({ queryKey: ["all-orgs"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to toggle organization status");
    },
  });

  const createOrgMutation = useMutation({
    mutationFn: ({ name, force }: { name: string; force?: boolean }) => 
      api.createOrg({ name, force: force || false }),
    onSuccess: (org) => {
      toast.success(`Organization "${org.name}" created successfully`);
      setCreateOrgModalOpen(false);
      setNewOrgName("");
      setDuplicateConfirmOpen(false);
      setPendingOrgName("");
      queryClient.invalidateQueries({ queryKey: ["all-orgs"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error: any) => {
      // Check if it's a 409 Conflict (duplicate name)
      if (error?.response?.status === 409) {
        setPendingOrgName(newOrgName);
        setDuplicateConfirmOpen(true);
      } else {
        toast.error(error.message || "Failed to create organization");
      }
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
    }) => api.reviewOrgRequestSuperAdmin(requestId, { status, review_notes: notes }),
    onSuccess: () => {
      toast.success("Organization request reviewed successfully");
      setReviewModalOpen(false);
      setSelectedRequest(null);
      setReviewNotes("");
      queryClient.invalidateQueries({ queryKey: ["all-org-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-orgs"] });
      // Invalidate "me" query to refresh memberships for the requesting user
      // Note: This only helps if the requesting user refreshes their page
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

  if (meLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <p className="text-center">Loading user data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (meError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
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

  // Check if user is super admin
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage all organizations and users in the system
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="orgs">Organizations</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="orgs">
          <Card>
            <CardHeader>
              <CardTitle>All Organizations</CardTitle>
            </CardHeader>
            <CardContent>
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
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Created</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgs.map((org) => (
                        <tr key={org.id} className="border-b">
                          <td className="p-2">{org.id}</td>
                          <td className="p-2 font-medium">{org.name}</td>
                          <td className="p-2">
                            <Badge variant={org.is_active ? "default" : "destructive"}>
                              {org.is_active ? "Active" : "Disabled"}
                            </Badge>
                          </td>
                          <td className="p-2 text-sm text-muted-foreground">
                            {format(new Date(org.created_at), "PPp")}
                          </td>
                          <td className="p-2">
                            <Button
                              variant={org.is_active ? "destructive" : "default"}
                              size="sm"
                              onClick={() => toggleStatusMutation.mutate(org.id)}
                              disabled={toggleStatusMutation.isPending}
                            >
                              {org.is_active ? "Disable" : "Enable"}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
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
                  No organization requests found.
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
                        <Badge variant={request.status === "PENDING" ? "secondary" : request.status === "APPROVED" ? "default" : "destructive"}>
                          {request.status}
                        </Badge>
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
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Note: Users are created automatically when they first sign in and make an API call.
                If a user signed up in Clerk but hasn&apos;t logged in yet, they won&apos;t appear here.
              </p>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              ) : !users || users.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No users found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">ID</th>
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Super Admin</th>
                        <th className="text-left p-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b">
                          <td className="p-2">{user.id}</td>
                          <td className="p-2 font-medium">{user.email}</td>
                          <td className="p-2">{user.name || "-"}</td>
                          <td className="p-2">
                            {user.is_super_admin ? (
                              <Badge variant="destructive">Super Admin</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-2 text-sm text-muted-foreground">
                            {format(new Date(user.created_at), "PPp")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Organization Dialog */}
      <Dialog open={createOrgModalOpen} onOpenChange={setCreateOrgModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Organization</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newOrgName.trim()) {
                toast.error("Organization name is required");
                return;
              }
              createOrgMutation.mutate({ name: newOrgName.trim() });
            }}
          >
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Organization Name *
                </label>
                <Input
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g., Marina Bay Yacht Club"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateOrgModalOpen(false);
                  setNewOrgName("");
                }}
                disabled={createOrgMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createOrgMutation.isPending}>
                {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review Request Dialog */}
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
