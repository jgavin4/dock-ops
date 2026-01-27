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
import { format } from "date-fns";

export default function SuperAdminPage() {
  const { isSignedIn } = useUser();
  const router = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("orgs");

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

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Note: Users are created automatically when they first sign in and make an API call.
                If a user signed up in Clerk but hasn't logged in yet, they won't appear here.
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
    </div>
  );
}
