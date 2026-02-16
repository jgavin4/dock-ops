"use client";

import { useAuth } from "@clerk/nextjs";
import { useOrg } from "@/contexts/org-context";
import * as api from "@/lib/api";

/**
 * Hook that provides API functions with auth token and org context automatically injected.
 */
export function useApi() {
  const { getToken } = useAuth();
  const { orgId } = useOrg();

  const withAuth = async <T>(
    fn: (token: string, orgId: number | null) => Promise<T>
  ): Promise<T> => {
    const token = await getToken();
    if (!token) {
      throw new Error("Not authenticated");
    }
    return fn(token, orgId);
  };

  return {
    // Vessels
    listVessels: () =>
      withAuth((token, orgId) =>
        api.apiRequest<api.Vessel[]>("/api/vessels", {}, orgId, token)
      ),
    getVessel: (id: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.Vessel>(`/api/vessels/${id}`, {}, orgId, token)
      ),
    createVessel: (data: api.VesselCreate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.Vessel>("/api/vessels", {
          method: "POST",
          body: JSON.stringify(data),
        }, orgId, token)
      ),
    updateVessel: (id: number, data: api.VesselUpdate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.Vessel>(`/api/vessels/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        }, orgId, token)
      ),
    // Inventory
    listInventoryRequirements: (vesselId: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryRequirement[]>(
          `/api/vessels/${vesselId}/inventory/requirements`,
          {},
          orgId,
          token
        )
      ),
    createInventoryRequirement: (vesselId: number, data: api.InventoryRequirementCreate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryRequirement>(
          `/api/vessels/${vesselId}/inventory/requirements`,
          {
            method: "POST",
            body: JSON.stringify(data),
          },
          orgId,
          token
        )
      ),
    updateInventoryRequirement: (id: number, data: api.InventoryRequirementUpdate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryRequirement>(
          `/api/inventory/requirements/${id}`,
          {
            method: "PATCH",
            body: JSON.stringify(data),
          },
          orgId,
          token
        )
      ),
    deleteInventoryRequirement: (id: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<void>(`/api/inventory/requirements/${id}`, {
          method: "DELETE",
        }, orgId, token)
      ),
    getRequirementHistory: (requirementId: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryCheckLine[]>(
          `/api/inventory/requirements/${requirementId}/history`,
          {},
          orgId,
          token
        )
      ),
    // Inventory Groups
    listInventoryGroups: (vesselId: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryGroup[]>(
          `/api/vessels/${vesselId}/inventory/groups`,
          {},
          orgId,
          token
        )
      ),
    createInventoryGroup: (vesselId: number, data: api.InventoryGroupCreate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryGroup>(
          `/api/vessels/${vesselId}/inventory/groups`,
          {
            method: "POST",
            body: JSON.stringify(data),
          },
          orgId,
          token
        )
      ),
    updateInventoryGroup: (id: number, data: api.InventoryGroupUpdate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryGroup>(
          `/api/inventory/groups/${id}`,
          {
            method: "PATCH",
            body: JSON.stringify(data),
          },
          orgId,
          token
        )
      ),
    deleteInventoryGroup: (id: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<void>(`/api/inventory/groups/${id}`, {
          method: "DELETE",
        }, orgId, token)
      ),
    reorderInventoryGroups: (vesselId: number, groupIds: number[]) =>
      withAuth((token, orgId) =>
        api.apiRequest<void>(
          `/api/vessels/${vesselId}/inventory/groups/reorder`,
          {
            method: "PUT",
            body: JSON.stringify({ group_ids: groupIds }),
          },
          orgId,
          token
        )
      ),
    reorderInventoryItems: (
      vesselId: number,
      groupId: number | null,
      itemIds: number[]
    ) =>
      withAuth((token, orgId) =>
        api.apiRequest<void>(
          `/api/vessels/${vesselId}/inventory/items/reorder`,
          {
            method: "PUT",
            body: JSON.stringify({ group_id: groupId, item_ids: itemIds }),
          },
          orgId,
          token
        )
      ),
    listInventoryChecks: (vesselId: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryCheck[]>(
          `/api/vessels/${vesselId}/inventory/checks`,
          {},
          orgId,
          token
        )
      ),
    getInventoryCheck: (id: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryCheck>(`/api/inventory/checks/${id}`, {}, orgId, token)
      ),
    createInventoryCheck: (vesselId: number, data: api.InventoryCheckCreate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryCheck>(
          `/api/vessels/${vesselId}/inventory/checks`,
          {
            method: "POST",
            body: JSON.stringify(data),
          },
          orgId,
          token
        )
      ),
    updateInventoryCheckLines: (checkId: number, data: api.InventoryCheckLinesBulkUpdate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryCheck>(
          `/api/inventory/checks/${checkId}/lines`,
          {
            method: "PUT",
            body: JSON.stringify(data),
          },
          orgId,
          token
        )
      ),
    submitInventoryCheck: (checkId: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.InventoryCheck>(
          `/api/inventory/checks/${checkId}/submit`,
          {
            method: "POST",
          },
          orgId,
          token
        )
      ),
    // Maintenance
    listMaintenanceTasks: (vesselId: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.MaintenanceTask[]>(
          `/api/vessels/${vesselId}/maintenance/tasks`,
          {},
          orgId,
          token
        )
      ),
    createMaintenanceTask: (vesselId: number, data: api.MaintenanceTaskCreate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.MaintenanceTask>(
          `/api/vessels/${vesselId}/maintenance/tasks`,
          {
            method: "POST",
            body: JSON.stringify(data),
          },
          orgId,
          token
        )
      ),
    updateMaintenanceTask: (taskId: number, data: api.MaintenanceTaskUpdate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.MaintenanceTask>(
          `/api/maintenance/tasks/${taskId}`,
          {
            method: "PATCH",
            body: JSON.stringify(data),
          },
          orgId,
          token
        )
      ),
    reorderMaintenanceTasks: (vesselId: number, taskIds: number[]) =>
      withAuth((token, orgId) =>
        api.apiRequest<void>(
          `/api/vessels/${vesselId}/maintenance/tasks/reorder`,
          {
            method: "PUT",
            body: JSON.stringify({ task_ids: taskIds }),
          },
          orgId,
          token
        )
      ),
    createMaintenanceLog: (taskId: number, data: api.MaintenanceLogCreate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.MaintenanceLog>(
          `/api/maintenance/tasks/${taskId}/logs`,
          {
            method: "POST",
            body: JSON.stringify(data),
          },
          orgId,
          token
        )
      ),
    listMaintenanceLogs: (taskId: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.MaintenanceLog[]>(
          `/api/maintenance/tasks/${taskId}/logs`,
          {},
          orgId,
          token
        )
      ),
    // Comments
    listVesselComments: (vesselId: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.VesselComment[]>(
          `/api/vessels/${vesselId}/comments`,
          {},
          orgId,
          token
        )
      ),
    createVesselComment: (vesselId: number, data: api.VesselCommentCreate) =>
      withAuth((token, orgId) =>
        api.apiRequest<api.VesselComment>(
          `/api/vessels/${vesselId}/comments`,
          {
            method: "POST",
            body: JSON.stringify(data),
          },
          orgId,
          token
        )
      ),
    // Orgs (no orgId needed for these)
    createOrg: (data: { name: string; force?: boolean }) =>
      withAuth((token) =>
        api.apiRequest<api.Organization>("/api/orgs", {
          method: "POST",
          body: JSON.stringify(data),
        }, null, token)
      ),
    listOrgs: () =>
      withAuth((token) =>
        api.apiRequest<api.Organization[]>("/api/orgs", {}, null, token)
      ),
    getMe: () =>
      withAuth((token) =>
        api.apiRequest<api.Me>("/api/me", {}, null, token)
      ),
    listOrgMembers: (orgId: number) =>
      withAuth((token) =>
        api.apiRequest<api.OrgMembership[]>(`/api/orgs/${orgId}/members`, {}, orgId, token)
      ),
    createOrgInvite: (orgId: number, data: api.OrgInviteCreate) =>
      withAuth((token) =>
        api.apiRequest<api.OrgInvite>(`/api/orgs/${orgId}/invites`, {
          method: "POST",
          body: JSON.stringify(data),
        }, orgId, token)
      ),
    acceptInvite: (data: api.OrgInviteAccept) =>
      withAuth((token) =>
        api.apiRequest<api.OrgMembership>("/api/orgs/invites/accept", {
          method: "POST",
          body: JSON.stringify(data),
        }, null, token)
      ),
    updateMemberRole: (orgId: number, userId: number, data: api.MemberRoleUpdate) =>
      withAuth((token) =>
        api.apiRequest<api.OrgMembership>(
          `/api/orgs/${orgId}/members/${userId}/role`,
          {
            method: "POST",
            body: JSON.stringify(data),
          },
          orgId,
          token
        )
      ),
    disableMember: (orgId: number, userId: number) =>
      withAuth((token) =>
        api.apiRequest<api.OrgMembership>(
          `/api/orgs/${orgId}/members/${userId}/disable`,
          {
            method: "POST",
          },
          orgId,
          token
        )
      ),
    // Organization Requests
    createOrgRequest: (data: { org_name: string }) =>
      withAuth((token) =>
        api.apiRequest<api.OrganizationRequest>("/api/orgs/requests", {
          method: "POST",
          body: JSON.stringify(data),
        }, null, token)
      ),
    listOrgRequests: () =>
      withAuth((token) =>
        api.apiRequest<api.OrganizationRequest[]>("/api/orgs/requests", {}, null, token)
      ),
    reviewOrgRequest: (requestId: number, data: { status: string; review_notes?: string }) =>
      withAuth((token) =>
        api.apiRequest<api.OrganizationRequest>(
          `/api/orgs/requests/${requestId}/review`,
          {
            method: "POST",
            body: JSON.stringify(data),
          },
          null,
          token
        )
      ),
    // Import
    importVessels: (file: File) =>
      withAuth((token, orgId) =>
        api.importVessels(file, orgId, token)
      ),
    importInventoryRequirements: (vesselId: number, file: File) =>
      withAuth((token, orgId) =>
        api.importInventoryRequirements(vesselId, file, orgId, token)
      ),
    importMaintenanceTasks: (vesselId: number, file: File) =>
      withAuth((token, orgId) =>
        api.importMaintenanceTasks(vesselId, file, orgId, token)
      ),
    // Super Admin endpoints
    listAllOrgs: () =>
      withAuth((token) =>
        api.apiRequest<api.Organization[]>("/api/admin/orgs", {}, null, token)
      ),
    toggleOrgStatus: (orgId: number) =>
      withAuth((token) =>
        api.apiRequest<api.Organization>(
          `/api/admin/orgs/${orgId}/toggle-status`,
          {
            method: "POST",
          },
          null,
          token
        )
      ),
    listAllUsers: () =>
      withAuth((token) =>
        api.apiRequest<api.User[]>("/api/admin/users", {}, null, token)
      ),
    listAllOrgRequests: () =>
      withAuth((token) =>
        api.apiRequest<api.OrganizationRequest[]>("/api/admin/orgs/requests", {}, null, token)
      ),
    reviewOrgRequestSuperAdmin: (requestId: number, data: { status: string; review_notes?: string }) =>
      withAuth((token) =>
        api.apiRequest<api.OrganizationRequest>(
          `/api/admin/orgs/requests/${requestId}/review`,
          {
            method: "POST",
            body: JSON.stringify(data),
          },
          null,
          token
        )
      ),
    // Internal super admin endpoints
    searchOrgs: (query?: string) =>
      withAuth((token) =>
        api.apiRequest<api.Organization[]>(
          `/api/internal/orgs${query ? `?query=${encodeURIComponent(query)}` : ""}`,
          {},
          null,
          token
        )
      ),
    updateBillingOverride: (orgId: number, data: {
      billing_override_enabled?: boolean;
      billing_override_vessel_limit?: number | null;
      billing_override_expires_at?: string | null;
      billing_override_reason?: string | null;
    }) =>
      withAuth((token) =>
        api.apiRequest<api.Organization>(
          `/api/internal/orgs/${orgId}/billing-override`,
          {
            method: "PATCH",
            body: JSON.stringify(data),
          },
          null,
          token
        )
      ),
    // Org admin billing endpoint
    getOrgBilling: (orgId: number) =>
      withAuth((token, currentOrgId) =>
        api.apiRequest<{
          org_id: number;
          org_name: string;
          subscription_plan: string | null;
          subscription_status: string | null;
          vessel_usage: { current: number; limit: number | null };
          billing_override: { active: boolean; expires_at: string | null };
          effective_entitlement: { is_active: boolean; vessel_limit: number | null };
        }>(`/api/orgs/${orgId}/billing`, {}, currentOrgId, token)
      ),
    // Billing endpoints
    getBillingStatus: () =>
      withAuth((token, orgId) =>
        api.apiRequest<{
          org_id: number;
          org_name: string;
          plan: string | null;
          status: string | null;
          current_period_end: string | null;
          addon_pack_quantity: number;
          base_vessels_included: number;
          vessels_per_pack: number;
          vessel_limit: number | null;
          effective_vessel_limit: number | null;
          vessel_usage: { current: number; limit: number | null };
          billing_override: { active: boolean; expires_at: string | null };
        }>("/api/billing/status", {}, orgId, token)
      ),
    createCheckoutSession: (pack_quantity: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<{ url: string }>("/api/billing/checkout-session", {
          method: "POST",
          body: JSON.stringify({ pack_quantity }),
        }, orgId, token)
      ),
    updateVesselPacks: (pack_quantity: number) =>
      withAuth((token, orgId) =>
        api.apiRequest<{ status: string; pack_quantity: number }>(
          "/api/billing/update-vessel-packs",
          {
            method: "POST",
            body: JSON.stringify({ pack_quantity }),
          },
          orgId,
          token
        )
      ),
    createPortalSession: () =>
      withAuth((token, orgId) =>
        api.apiRequest<{ url: string }>(
          "/api/billing/portal",
          {
            method: "POST",
          },
          orgId,
          token
        )
      ),
  };
}
