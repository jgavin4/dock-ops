// API base URL
// Local dev: http://localhost:8000 (or leave empty to use Next.js rewrites)
// Production: https://api.dock-ops.com
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  orgId?: string | number | null,
  token?: string | null
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  
  // Add org ID header if provided
  if (orgId) {
    headers["X-Org-Id"] = String(orgId);
  }
  
  // Add auth token if provided
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers: headers as HeadersInit,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    const error = new Error(errorMessage) as any;
    error.response = { status: response.status, statusText: response.statusText };
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Types
export type VesselCreate = {
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  description: string | null;
  location: string | null;
};

export type VesselUpdate = {
  name?: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  description?: string | null;
  location?: string | null;
};

export type Vessel = {
  id: number;
  org_id: number;
  name: string;
  make: string | null;
  model: string | null;
  year: number | null;
  description: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryRequirement = {
  id: number;
  vessel_id: number;
  parent_group_id: number | null;
  sort_order: number | null;
  item_name: string;
  required_quantity: number;
  category: string | null;
  critical: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryRequirementCreate = {
  item_name: string;
  required_quantity: number;
  category?: string | null;
  critical?: boolean;
  notes?: string | null;
  parent_group_id?: number | null;
};

export type InventoryRequirementUpdate = {
  item_name?: string;
  required_quantity?: number;
  category?: string | null;
  critical?: boolean;
  notes?: string | null;
  parent_group_id?: number | null;
};

export type InventoryGroup = {
  id: number;
  vessel_id: number;
  name: string;
  description: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type InventoryGroupCreate = {
  name: string;
  description?: string | null;
};

export type InventoryGroupUpdate = {
  name?: string;
  description?: string | null;
};

export type InventoryCheckStatus = "in_progress" | "submitted";

export type InventoryCheckLineCondition = "ok" | "needs_replacement" | "missing";

export type InventoryCheck = {
  id: number;
  vessel_id: number;
  performed_by_user_id: number;
  performed_at: string;
  status: InventoryCheckStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lines?: InventoryCheckLine[];
  performed_by_name?: string | null;
  performed_by_email?: string | null;
};

export type InventoryCheckLine = {
  id: number;
  inventory_check_id: number;
  requirement_id: number;
  actual_quantity: number;
  condition: InventoryCheckLineCondition;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryCheckLineCreate = {
  requirement_id: number;
  actual_quantity: number;
  condition: InventoryCheckLineCondition;
  notes?: string | null;
};

export type InventoryCheckCreate = {
  notes?: string | null;
};

export type InventoryCheckLinesBulkUpdate = {
  lines: InventoryCheckLineCreate[];
};

export type MaintenanceCadenceType = "interval" | "specific_date";

export type MaintenanceTask = {
  id: number;
  vessel_id: number;
  name: string;
  description: string | null;
  cadence_type: MaintenanceCadenceType;
  interval_days: number | null;
  due_date: string | null;
  next_due_at: string | null;
  critical: boolean;
  is_active: boolean;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceTaskCreate = {
  name: string;
  description?: string | null;
  cadence_type: MaintenanceCadenceType;
  interval_days?: number | null;
  due_date?: string | null;
  next_due_at?: string | null;
  critical?: boolean;
  is_active?: boolean;
};

export type MaintenanceTaskUpdate = {
  name?: string;
  description?: string | null;
  cadence_type?: MaintenanceCadenceType;
  interval_days?: number | null;
  due_date?: string | null;
  next_due_at?: string | null;
  critical?: boolean;
  is_active?: boolean;
};

export type MaintenanceLog = {
  id: number;
  maintenance_task_id: number;
  performed_by_user_id: number;
  performed_at: string;
  notes: string | null;
  created_at: string;
  performed_by_name?: string | null;
  performed_by_email?: string | null;
};

export type MaintenanceLogCreate = {
  performed_at?: string | null;
  notes?: string | null;
};

export type VesselComment = {
  id: number;
  vessel_id: number;
  user_id: number;
  body: string;
  created_at: string;
};

export type VesselCommentCreate = {
  body: string;
};

// Vessel API
export async function listVessels(): Promise<Vessel[]> {
  return apiRequest<Vessel[]>("/api/vessels");
}

export async function getVessel(id: number): Promise<Vessel> {
  return apiRequest<Vessel>(`/api/vessels/${id}`);
}

export async function createVessel(data: VesselCreate): Promise<Vessel> {
  return apiRequest<Vessel>("/api/vessels", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateVessel(
  id: number,
  data: VesselUpdate
): Promise<Vessel> {
  return apiRequest<Vessel>(`/api/vessels/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Inventory Requirements API
export async function listInventoryRequirements(
  vesselId: number
): Promise<InventoryRequirement[]> {
  return apiRequest<InventoryRequirement[]>(
    `/api/vessels/${vesselId}/inventory/requirements`
  );
}

export async function createInventoryRequirement(
  vesselId: number,
  data: InventoryRequirementCreate
): Promise<InventoryRequirement> {
  return apiRequest<InventoryRequirement>(
    `/api/vessels/${vesselId}/inventory/requirements`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function updateInventoryRequirement(
  id: number,
  data: InventoryRequirementUpdate
): Promise<InventoryRequirement> {
  return apiRequest<InventoryRequirement>(`/api/inventory/requirements/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteInventoryRequirement(
  id: number
): Promise<void> {
  return apiRequest<void>(`/api/inventory/requirements/${id}`, {
    method: "DELETE",
  });
}

export async function getRequirementHistory(
  requirementId: number
): Promise<InventoryCheckLine[]> {
  return apiRequest<InventoryCheckLine[]>(
    `/api/inventory/requirements/${requirementId}/history`
  );
}

// Inventory Groups API
export async function listInventoryGroups(
  vesselId: number
): Promise<InventoryGroup[]> {
  return apiRequest<InventoryGroup[]>(
    `/api/vessels/${vesselId}/inventory/groups`
  );
}

export async function createInventoryGroup(
  vesselId: number,
  data: InventoryGroupCreate
): Promise<InventoryGroup> {
  return apiRequest<InventoryGroup>(
    `/api/vessels/${vesselId}/inventory/groups`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function updateInventoryGroup(
  id: number,
  data: InventoryGroupUpdate
): Promise<InventoryGroup> {
  return apiRequest<InventoryGroup>(`/api/inventory/groups/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteInventoryGroup(id: number): Promise<void> {
  return apiRequest<void>(`/api/inventory/groups/${id}`, {
    method: "DELETE",
  });
}

export async function reorderInventoryGroups(
  vesselId: number,
  groupIds: number[]
): Promise<void> {
  return apiRequest<void>(
    `/api/vessels/${vesselId}/inventory/groups/reorder`,
    {
      method: "PUT",
      body: JSON.stringify({ group_ids: groupIds }),
    }
  );
}

export async function reorderInventoryItems(
  vesselId: number,
  groupId: number | null,
  itemIds: number[]
): Promise<void> {
  return apiRequest<void>(
    `/api/vessels/${vesselId}/inventory/items/reorder`,
    {
      method: "PUT",
      body: JSON.stringify({ group_id: groupId, item_ids: itemIds }),
    }
  );
}

// Inventory Checks API
export async function listInventoryChecks(
  vesselId: number
): Promise<InventoryCheck[]> {
  return apiRequest<InventoryCheck[]>(
    `/api/vessels/${vesselId}/inventory/checks`
  );
}

export async function getInventoryCheck(id: number): Promise<InventoryCheck> {
  return apiRequest<InventoryCheck>(`/api/inventory/checks/${id}`);
}

export async function createInventoryCheck(
  vesselId: number,
  data: InventoryCheckCreate
): Promise<InventoryCheck> {
  return apiRequest<InventoryCheck>(
    `/api/vessels/${vesselId}/inventory/checks`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function updateInventoryCheckLines(
  checkId: number,
  data: InventoryCheckLinesBulkUpdate
): Promise<InventoryCheck> {
  return apiRequest<InventoryCheck>(`/api/inventory/checks/${checkId}/lines`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function submitInventoryCheck(
  checkId: number
): Promise<InventoryCheck> {
  return apiRequest<InventoryCheck>(
    `/api/inventory/checks/${checkId}/submit`,
    {
      method: "POST",
    }
  );
}

// Maintenance API
export async function listMaintenanceTasks(
  vesselId: number
): Promise<MaintenanceTask[]> {
  return apiRequest<MaintenanceTask[]>(
    `/api/vessels/${vesselId}/maintenance/tasks`
  );
}

export async function createMaintenanceTask(
  vesselId: number,
  data: MaintenanceTaskCreate
): Promise<MaintenanceTask> {
  return apiRequest<MaintenanceTask>(
    `/api/vessels/${vesselId}/maintenance/tasks`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function updateMaintenanceTask(
  taskId: number,
  data: MaintenanceTaskUpdate
): Promise<MaintenanceTask> {
  return apiRequest<MaintenanceTask>(`/api/maintenance/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function reorderMaintenanceTasks(
  vesselId: number,
  taskIds: number[]
): Promise<void> {
  return apiRequest<void>(
    `/api/vessels/${vesselId}/maintenance/tasks/reorder`,
    {
      method: "PUT",
      body: JSON.stringify({ task_ids: taskIds }),
    }
  );
}

export async function createMaintenanceLog(
  taskId: number,
  data: MaintenanceLogCreate
): Promise<MaintenanceLog> {
  return apiRequest<MaintenanceLog>(
    `/api/maintenance/tasks/${taskId}/logs`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function listMaintenanceLogs(
  taskId: number
): Promise<MaintenanceLog[]> {
  return apiRequest<MaintenanceLog[]>(
    `/api/maintenance/tasks/${taskId}/logs`
  );
}

// Comments API
export async function listVesselComments(
  vesselId: number
): Promise<VesselComment[]> {
  return apiRequest<VesselComment[]>(`/api/vessels/${vesselId}/comments`);
}

export async function createVesselComment(
  vesselId: number,
  data: VesselCommentCreate
): Promise<VesselComment> {
  return apiRequest<VesselComment>(`/api/vessels/${vesselId}/comments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Organization API
export type Organization = {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OrgMembership = {
  id: number;
  org_id: number;
  user_id: number;
  role: "ADMIN" | "MANAGER" | "TECH";
  status: "ACTIVE" | "INVITED" | "DISABLED";
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string | null;
};

export type OrgMembershipSummary = {
  org_id: number;
  org_name: string;
  role: "ADMIN" | "MANAGER" | "TECH";
  status: "ACTIVE" | "INVITED" | "DISABLED";
};

export type User = {
  id: number;
  email: string;
  name: string | null;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Me = {
  user: User;
  memberships: OrgMembershipSummary[];
};

export type OrgInviteCreate = {
  email: string;
  role: "ADMIN" | "MANAGER" | "TECH";
};

export type OrgInvite = {
  id: number;
  org_id: number;
  email: string;
  role: "ADMIN" | "MANAGER" | "TECH";
  invited_by_user_id: number;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

export type OrgInviteAccept = {
  token: string;
};

export type MemberRoleUpdate = {
  role: "ADMIN" | "MANAGER" | "TECH";
};

export type OrganizationRequest = {
  id: number;
  requested_by_user_id: number;
  org_name: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewed_by_user_id: number | null;
  review_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  updated_at: string;
  requested_by_email?: string | null;
  requested_by_name?: string | null;
};

export async function createOrg(data: { name: string; force?: boolean }): Promise<Organization> {
  return apiRequest<Organization>("/api/orgs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function listOrgs(): Promise<Organization[]> {
  return apiRequest<Organization[]>("/api/orgs");
}

export async function getMe(): Promise<Me> {
  return apiRequest<Me>("/api/me");
}

export async function listOrgMembers(orgId: number): Promise<OrgMembership[]> {
  return apiRequest<OrgMembership[]>(`/api/orgs/${orgId}/members`);
}

export async function createOrgInvite(
  orgId: number,
  data: OrgInviteCreate
): Promise<OrgInvite> {
  return apiRequest<OrgInvite>(`/api/orgs/${orgId}/invites`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function acceptInvite(
  data: OrgInviteAccept
): Promise<OrgMembership> {
  return apiRequest<OrgMembership>("/api/orgs/invites/accept", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMemberRole(
  orgId: number,
  userId: number,
  data: MemberRoleUpdate
): Promise<OrgMembership> {
  return apiRequest<OrgMembership>(
    `/api/orgs/${orgId}/members/${userId}/role`,
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
}

export async function disableMember(
  orgId: number,
  userId: number
): Promise<OrgMembership> {
  return apiRequest<OrgMembership>(
    `/api/orgs/${orgId}/members/${userId}/disable`,
    {
      method: "POST",
    }
  );
}

// Import API
export type ImportResult = {
  success: boolean;
  created_count: number;
  error_count: number;
  created: Array<{ id: number; name?: string; item_name?: string }>;
  errors: Array<{ row: number; error: string }>;
};

export async function importVessels(
  file: File,
  orgId?: string | number | null,
  token?: string | null
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  
  const url = `${API_BASE_URL}/api/import/vessels`;
  const headers: Record<string, string> = {};
  
  if (orgId) {
    headers["X-Org-Id"] = String(orgId);
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    method: "POST",
    headers: headers as HeadersInit,
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  return response.json();
}

export async function importInventoryRequirements(
  vesselId: number,
  file: File,
  orgId?: string | number | null,
  token?: string | null
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  
  const url = `${API_BASE_URL}/api/import/vessels/${vesselId}/inventory-requirements`;
  const headers: HeadersInit = {};
  
  if (orgId) {
    headers["X-Org-Id"] = String(orgId);
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  return response.json();
}

export async function importMaintenanceTasks(
  vesselId: number,
  file: File,
  orgId?: string | number | null,
  token?: string | null
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  
  const url = `${API_BASE_URL}/api/import/vessels/${vesselId}/maintenance-tasks`;
  const headers: Record<string, string> = {};
  
  if (orgId) {
    headers["X-Org-Id"] = String(orgId);
  }
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(url, {
    method: "POST",
    headers: headers as HeadersInit,
    body: formData,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.detail || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }
  
  return response.json();
}
