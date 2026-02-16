"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApi } from "@/hooks/use-api";
import type { VesselUpdate, InventoryGroup, InventoryGroupCreate, InventoryGroupUpdate } from "@/lib/api";
import type {
  InventoryRequirement,
  InventoryRequirementCreate,
  InventoryRequirementUpdate,
  InventoryCheck,
  InventoryCheckLine,
  InventoryCheckLineCreate,
  MaintenanceLog,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ImportDialog } from "@/components/import-dialog";
import Link from "next/link";
import { format } from "date-fns";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

function DragHandleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M8 6h.01" />
      <path d="M8 12h.01" />
      <path d="M8 18h.01" />
      <path d="M16 6h.01" />
      <path d="M16 12h.01" />
      <path d="M16 18h.01" />
    </svg>
  );
}

function SortableSectionRow({
  id,
  children,
  disabled,
}: {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 w-full",
        isDragging && "opacity-50 z-10"
      )}
    >
      {!disabled && (
        <span
          className="touch-none cursor-grab active:cursor-grabbing p-1.5 -ml-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80"
          {...listeners}
          {...attributes}
          aria-label="Drag to reorder group"
        >
          <DragHandleIcon />
        </span>
      )}
      {children}
    </div>
  );
}

function SortableRequirementCard({
  id,
  children,
  disabled,
}: {
  id: number;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(id), disabled });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-start gap-2",
        isDragging && "opacity-50 shadow-lg z-10"
      )}
    >
      {!disabled && (
        <span
          className="touch-none cursor-grab active:cursor-grabbing p-1.5 rounded mt-3 text-muted-foreground hover:text-foreground hover:bg-muted/80 shrink-0"
          {...listeners}
          {...attributes}
          aria-label="Drag to reorder item"
        >
          <DragHandleIcon />
        </span>
      )}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function SortableMaintenanceRow({
  id,
  children,
  disabled,
}: {
  id: number;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(id), disabled });
  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(isDragging && "opacity-50 bg-muted/50")}
    >
      <td className="p-2 w-10 align-top">
        {!disabled && (
          <span
            className="touch-none cursor-grab active:cursor-grabbing p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 inline-block"
            {...listeners}
            {...attributes}
            aria-label="Drag to reorder task"
          >
            <DragHandleIcon />
          </span>
        )}
      </td>
      {children}
    </tr>
  );
}

// Utility function to get user initials
function getUserInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "??";
}

function OverviewTab({ vessel }: { vessel: any }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<VesselUpdate>({
    location: vessel.location || null,
    description: vessel.description || null,
  });

  const updateMutation = useMutation({
    mutationFn: (data: VesselUpdate) => api.updateVessel(vessel.id, data),
    onSuccess: () => {
      toast.success("Vessel updated successfully");
      queryClient.invalidateQueries({ queryKey: ["vessels", vessel.id] });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update vessel");
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const handleCancel = () => {
    setFormData({
      location: vessel.location || null,
      description: vessel.description || null,
    });
    setIsEditing(false);
  };

  // Helper function to safely format dates
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "PPp");
    } catch {
      return dateString;
    }
  };

  const makeModelYear = [vessel.make, vessel.model, vessel.year?.toString()]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Details</CardTitle>
            </div>
            {!isEditing && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Name
            </label>
            <p className="text-base font-medium mt-1">{vessel.name}</p>
          </div>
          {makeModelYear && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Make / Model / Year
              </label>
              <p className="text-base mt-1">{makeModelYear}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Location
            </label>
            {isEditing ? (
              <Input
                value={formData.location || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    location: e.target.value || null,
                  })
                }
                placeholder="Location"
                className="mt-1"
              />
            ) : (
              <p className="text-base mt-1">
                {vessel.location || "Not set"}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Description
            </label>
            {isEditing ? (
              <Textarea
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    description: e.target.value || null,
                  })
                }
                placeholder="Description"
                rows={4}
                className="mt-1"
              />
            ) : (
              <p className="text-base mt-1 whitespace-pre-wrap">
                {vessel.description || "No description"}
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Created
            </label>
            <p className="text-base mt-1">
              {formatDate(vessel.created_at)}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Last Updated
            </label>
            <p className="text-base mt-1">
              {formatDate(vessel.updated_at)}
            </p>
          </div>
          {isEditing && (
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InventoryTab({ vesselId }: { vesselId: number }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [requirementModalOpen, setRequirementModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] =
    useState<InventoryRequirement | null>(null);
  const [deleteRequirementId, setDeleteRequirementId] = useState<number | null>(
    null
  );
  const [inProgressCheckId, setInProgressCheckId] = useState<number | null>(null);
  const [importRequirementOpen, setImportRequirementOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<InventoryGroup | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: requirements, isLoading: requirementsLoading } = useQuery({
    queryKey: ["inventory-requirements", vesselId],
    queryFn: () => api.listInventoryRequirements(vesselId),
  });

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["inventory-groups", vesselId],
    queryFn: () => api.listInventoryGroups(vesselId),
    enabled: !!vesselId,
  });

  const { data: checks } = useQuery({
    queryKey: ["inventory-checks", vesselId],
    queryFn: () => api.listInventoryChecks(vesselId),
  });

  // Get in-progress check or create one
  const { data: inProgressCheck } = useQuery({
    queryKey: ["inventory-check", inProgressCheckId],
    queryFn: () => api.getInventoryCheck(inProgressCheckId!),
    enabled: !!inProgressCheckId,
  });

  // Get latest submitted check for historical quantities
  const latestSubmittedCheckId = checks?.find((c) => c.status === "submitted")?.id;
  const { data: latestSubmittedCheck } = useQuery({
    queryKey: ["inventory-check", latestSubmittedCheckId],
    queryFn: () => api.getInventoryCheck(latestSubmittedCheckId!),
    enabled: !!latestSubmittedCheckId && !inProgressCheckId,
  });

  useEffect(() => {
    // Find or create an in-progress check
    const inProgress = checks?.find((c) => c.status === "in_progress");
    if (inProgress) {
      setInProgressCheckId(inProgress.id);
    }
  }, [checks]);

  // Get latest quantities from in-progress check (preferred) or latest submitted check
  const latestQuantities = React.useMemo(() => {
    const quantities: Record<
      number,
      { qty: number; updatedAt: string; userName?: string | null; userEmail?: string | null }
    > = {};
    
    // Use in-progress check if available (most current)
    const checkToUse = inProgressCheck || latestSubmittedCheck;
    
    if (checkToUse?.lines) {
      checkToUse.lines.forEach((line) => {
        quantities[line.requirement_id] = {
          qty: line.actual_quantity,
          updatedAt: line.updated_at,
          userName: checkToUse.performed_by_name,
          userEmail: checkToUse.performed_by_email,
        };
      });
    }
    
    return quantities;
  }, [inProgressCheck, latestSubmittedCheck]);

  const createRequirementMutation = useMutation({
    mutationFn: (payload: InventoryRequirementCreate) =>
      api.createInventoryRequirement(vesselId, payload),
    onSuccess: () => {
      toast.success("Requirement created successfully");
      queryClient.invalidateQueries({
        queryKey: ["inventory-requirements", vesselId],
      });
      setRequirementModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create requirement");
    },
  });

  const updateRequirementMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: InventoryRequirementUpdate;
    }) => api.updateInventoryRequirement(id, payload),
    onSuccess: () => {
      toast.success("Requirement updated successfully");
      queryClient.invalidateQueries({
        queryKey: ["inventory-requirements", vesselId],
      });
      setRequirementModalOpen(false);
      setEditingRequirement(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update requirement");
    },
  });

  const deleteRequirementMutation = useMutation({
    mutationFn: (id: number) => api.deleteInventoryRequirement(id),
    onSuccess: () => {
      toast.success("Requirement deleted successfully");
      queryClient.invalidateQueries({
        queryKey: ["inventory-requirements", vesselId],
      });
      setDeleteRequirementId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete requirement");
    },
  });

  // Get or create in-progress check
  const getOrCreateInProgressCheck = async (): Promise<number> => {
    if (inProgressCheckId) return inProgressCheckId;
    
    const inProgress = checks?.find((c) => c.status === "in_progress");
    if (inProgress) {
      setInProgressCheckId(inProgress.id);
      return inProgress.id;
    }
    
    // Create new check
    const newCheck = await api.createInventoryCheck(vesselId, {});
    setInProgressCheckId(newCheck.id);
    queryClient.invalidateQueries({ queryKey: ["inventory-checks", vesselId] });
    return newCheck.id;
  };

  const updateQuantityMutation = useMutation({
    mutationFn: async ({
      requirementId,
      quantity,
    }: {
      requirementId: number;
      quantity: number;
    }) => {
      const checkId = await getOrCreateInProgressCheck();
      const currentCheck = await api.getInventoryCheck(checkId);
      
      // Update or add line for this requirement
      const existingLines = currentCheck.lines || [];
      const otherLines = existingLines
        .filter((l) => l.requirement_id !== requirementId)
        .map((l) => ({
          requirement_id: l.requirement_id,
          actual_quantity: l.actual_quantity,
          condition: l.condition as "ok" | "needs_replacement" | "missing",
          notes: l.notes || null,
        }));
      
      const updatedLines = [
        ...otherLines,
        {
          requirement_id: requirementId,
          actual_quantity: quantity,
          condition: "ok" as const,
          notes: null,
        },
      ];
      
      await api.updateInventoryCheckLines(checkId, { lines: updatedLines });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["inventory-check", inProgressCheckId],
      });
      queryClient.invalidateQueries({
        queryKey: ["inventory-checks", vesselId],
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update quantity");
    },
  });

  // Group mutations
  const createGroupMutation = useMutation({
    mutationFn: (payload: InventoryGroupCreate) =>
      api.createInventoryGroup(vesselId, payload),
    onSuccess: () => {
      toast.success("Group created successfully");
      queryClient.invalidateQueries({
        queryKey: ["inventory-groups", vesselId],
      });
      setGroupModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create group");
    },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: InventoryGroupUpdate;
    }) => api.updateInventoryGroup(id, payload),
    onSuccess: () => {
      toast.success("Group updated successfully");
      queryClient.invalidateQueries({
        queryKey: ["inventory-groups", vesselId],
      });
      setGroupModalOpen(false);
      setEditingGroup(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update group");
    },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id: number) => api.deleteInventoryGroup(id),
    onSuccess: () => {
      toast.success("Group deleted successfully");
      queryClient.invalidateQueries({
        queryKey: ["inventory-groups", vesselId],
      });
      queryClient.invalidateQueries({
        queryKey: ["inventory-requirements", vesselId],
      });
      setDeleteGroupId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete group");
    },
  });

  const reorderGroupsMutation = useMutation({
    mutationFn: (groupIds: number[]) =>
      api.reorderInventoryGroups(vesselId, groupIds),
    onMutate: async (groupIds) => {
      await queryClient.cancelQueries({
        queryKey: ["inventory-groups", vesselId],
      });
      const prev = queryClient.getQueryData<InventoryGroup[]>([
        "inventory-groups",
        vesselId,
      ]);
      if (!prev) return { prev };
      const orderMap = new Map(groupIds.map((id, i) => [id, i]));
      const sorted = [...prev].sort((a, b) => {
        const oa = orderMap.get(a.id) ?? 9999;
        const ob = orderMap.get(b.id) ?? 9999;
        return oa - ob;
      });
      queryClient.setQueryData(["inventory-groups", vesselId], sorted);
      return { prev };
    },
    onError: (_err, _groupIds, ctx) => {
      if (ctx?.prev)
        queryClient.setQueryData(
          ["inventory-groups", vesselId],
          ctx.prev
        );
      toast.error("Failed to reorder groups");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["inventory-groups", vesselId],
      });
    },
  });

  const reorderItemsMutation = useMutation({
    mutationFn: ({
      groupId,
      itemIds,
    }: {
      groupId: number | null;
      itemIds: number[];
    }) => api.reorderInventoryItems(vesselId, groupId, itemIds),
    onMutate: async ({ groupId, itemIds }) => {
      await queryClient.cancelQueries({
        queryKey: ["inventory-requirements", vesselId],
      });
      const prev = queryClient.getQueryData<InventoryRequirement[]>([
        "inventory-requirements",
        vesselId,
      ]);
      if (!prev) return { prev };
      const sectionIds = new Set(itemIds);
      const sectionReqs = itemIds.map((id) =>
        prev.find((r) => r.id === id)
      ).filter(Boolean) as InventoryRequirement[];
      const others = prev.filter((r) => !sectionIds.has(r.id));
      const firstIdx = prev.findIndex((r) => sectionIds.has(r.id));
      const reordered =
        firstIdx < 0
          ? prev
          : [
              ...prev.slice(0, firstIdx),
              ...sectionReqs,
              ...prev.slice(firstIdx + sectionReqs.length),
            ];
      queryClient.setQueryData(
        ["inventory-requirements", vesselId],
        reordered
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev)
        queryClient.setQueryData(
          ["inventory-requirements", vesselId],
          ctx.prev
        );
      toast.error("Failed to reorder items");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["inventory-requirements", vesselId],
      });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Build grouped list from API order (sort_order). Apply search by item name and group name.
  const inventorySections = React.useMemo(() => {
    if (!requirements) return [];
    const q = searchQuery.trim().toLowerCase();
    const groupById = new Map((groups ?? []).map((g) => [g.id, g]));

    const matches = (req: InventoryRequirement) => {
      if (!q) return true;
      const nameMatch = req.item_name.toLowerCase().includes(q);
      if (req.parent_group_id) {
        const group = groupById.get(req.parent_group_id);
        const groupMatch = group?.name.toLowerCase().includes(q);
        return nameMatch || groupMatch;
      }
      return nameMatch;
    };

    const grouped: Record<number, InventoryRequirement[]> = {};
    const ungrouped: InventoryRequirement[] = [];
    requirements.forEach((req) => {
      if (!matches(req)) return;
      if (req.parent_group_id) {
        if (!grouped[req.parent_group_id]) grouped[req.parent_group_id] = [];
        grouped[req.parent_group_id].push(req);
      } else {
        ungrouped.push(req);
      }
    });

    // Use API order: groups already sorted by sort_order from list endpoint
    const groupsWithItems = (groups ?? []).filter(
      (g) => (grouped[g.id]?.length ?? 0) > 0
    );

    const sections: Array<{
      id: string;
      name: string;
      items: InventoryRequirement[];
      group: InventoryGroup | null;
      missingCount: number;
    }> = [];

    groupsWithItems.forEach((group) => {
      const items = grouped[group.id] ?? [];
      let missingCount = 0;
      items.forEach((req) => {
        const current = latestQuantities[req.id]?.qty ?? 0;
        if (current < req.required_quantity)
          missingCount += req.required_quantity - current;
      });
      sections.push({
        id: `group-${group.id}`,
        name: group.name,
        items,
        group,
        missingCount,
      });
    });

    if (ungrouped.length > 0) {
      let missingCount = 0;
      ungrouped.forEach((req) => {
        const current = latestQuantities[req.id]?.qty ?? 0;
        if (current < req.required_quantity)
          missingCount += req.required_quantity - current;
      });
      sections.push({
        id: "ungrouped",
        name: "Ungrouped",
        items: ungrouped,
        group: null,
        missingCount,
      });
    }

    return sections;
  }, [requirements, groups, searchQuery, latestQuantities]);

  const sectionIds = inventorySections.map((s) => s.id);

  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sectionIds.indexOf(String(active.id));
    const newIndex = sectionIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(sectionIds, oldIndex, newIndex);
    const groupIds = newOrder
      .filter((id: string) => id !== "ungrouped")
      .map((id: string) => parseInt(id.replace("group-", ""), 10));
    if (groupIds.length === 0) return;
    reorderGroupsMutation.mutate(groupIds);
  };

  const handleItemDragEnd = (
    section: (typeof inventorySections)[0],
    event: DragEndEvent
  ) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const itemIds = section.items.map((r) => String(r.id));
    const oldIndex = itemIds.indexOf(String(active.id));
    const newIndex = itemIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(
      section.items.map((r) => r.id),
      oldIndex,
      newIndex
    );
    reorderItemsMutation.mutate({
      groupId: section.group?.id ?? null,
      itemIds: newOrder,
    });
  };

  const canEditInventory = true;

  // Helper function to render requirement card
  const renderRequirementCard = (req: InventoryRequirement) => {
    const currentQty = latestQuantities[req.id]?.qty ?? 0;
    const lastUpdated = latestQuantities[req.id]?.updatedAt;
    const isMissing = currentQty < req.required_quantity;
    return (
      <div
        key={req.id}
        className={`border rounded-lg p-4 ${
          req.critical && isMissing
            ? "border-destructive bg-destructive/5"
            : ""
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium">{req.item_name}</h4>
              {req.critical && (
                <Badge variant="destructive" className="text-xs">
                  Critical
                </Badge>
              )}
              {req.category && (
                <Badge variant="outline" className="text-xs">
                  {req.category}
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                Required: {req.required_quantity} | Current:{" "}
                <span
                  className={
                    isMissing ? "text-destructive font-medium" : ""
                  }
                >
                  {currentQty}
                </span>
                {isMissing && (
                  <span className="text-destructive ml-1">
                    ({req.required_quantity - currentQty} missing)
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-xs">
                  {lastUpdated
                    ? `Last updated: ${format(new Date(lastUpdated), "PPp")}`
                    : `Created: ${format(new Date(req.created_at), "PPp")}`}
                </p>
                {lastUpdated &&
                  latestQuantities[req.id] &&
                  (latestQuantities[req.id].userName ||
                    latestQuantities[req.id].userEmail) && (
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium bg-primary text-primary-foreground"
                      title={
                        latestQuantities[req.id].userName ||
                        latestQuantities[req.id].userEmail ||
                        "Unknown user"
                      }
                    >
                      {getUserInitials(
                        latestQuantities[req.id].userName,
                        latestQuantities[req.id].userEmail
                      )}
                    </span>
                  )}
              </div>
              {req.notes && (
                <p className="text-xs italic">{req.notes}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 ml-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateQuantityMutation.mutate({
                    requirementId: req.id,
                    quantity: Math.max(0, currentQty - 1),
                  })
                }
                disabled={
                  currentQty === 0 ||
                  updateQuantityMutation.isPending
                }
                className="h-8 w-8 p-0"
              >
                −
              </Button>
              <Input
                type="number"
                value={currentQty}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  updateQuantityMutation.mutate({
                    requirementId: req.id,
                    quantity: value,
                  });
                }}
                min="0"
                className="w-20 text-center"
                disabled={updateQuantityMutation.isPending}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  updateQuantityMutation.mutate({
                    requirementId: req.id,
                    quantity: currentQty + 1,
                  })
                }
                disabled={updateQuantityMutation.isPending}
                className="h-8 w-8 p-0"
              >
                +
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingRequirement(req);
                setRequirementModalOpen(true);
              }}
            >
              Edit
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Single inventory list: search + collapsible groups */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Inventory</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setGroupModalOpen(true)}>
                Add Group
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportRequirementOpen(true)}>
                Import
              </Button>
              <Button size="sm" onClick={() => setRequirementModalOpen(true)}>
                Add Requirement
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {requirementsLoading || groupsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !requirements || requirements.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No inventory requirements yet.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => setGroupModalOpen(true)} variant="outline" size="sm">
                  Add Group
                </Button>
                <Button onClick={() => setRequirementModalOpen(true)}>
                  Add Requirement
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Input
                type="search"
                placeholder="Search by item or group name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
                aria-label="Search inventory by item or group name"
              />
              {inventorySections.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No items match your search.
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  onDragEnd={handleGroupDragEnd}
                >
                  <SortableContext
                    items={sectionIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <Accordion
                      type="multiple"
                      defaultValue={inventorySections.map((s) => s.id)}
                    >
                      {inventorySections.map((section) => (
                        <AccordionItem key={section.id} value={section.id}>
                          <SortableSectionRow
                            id={section.id}
                            disabled={!canEditInventory}
                          >
                            <AccordionTrigger className="flex-1 py-3 hover:no-underline">
                              <span className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{section.name}</span>
                                <span className="text-muted-foreground text-sm font-normal">
                                  {section.items.length} item{section.items.length !== 1 ? "s" : ""}
                                </span>
                                {section.missingCount > 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    {section.missingCount} missing
                                  </Badge>
                                )}
                              </span>
                            </AccordionTrigger>
                            {section.group && (
                              <div
                                className="flex gap-1 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => {
                                    setEditingGroup(section.group!);
                                    setGroupModalOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                              </div>
                            )}
                          </SortableSectionRow>
                          <AccordionContent>
                            {section.group?.description && (
                              <p className="text-xs text-muted-foreground mb-3 pl-0">
                                {section.group.description}
                              </p>
                            )}
                            <DndContext
                              onDragEnd={(e: DragEndEvent) =>
                                handleItemDragEnd(section, e)
                              }
                            >
                              <SortableContext
                                items={section.items.map((r) => String(r.id))}
                                strategy={verticalListSortingStrategy}
                              >
                                <div className="space-y-3">
                                  {section.items.map((req) => (
                                    <SortableRequirementCard
                                      key={req.id}
                                      id={req.id}
                                      disabled={!canEditInventory}
                                    >
                                      {renderRequirementCard(req)}
                                    </SortableRequirementCard>
                                  ))}
                                </div>
                              </SortableContext>
                            </DndContext>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </SortableContext>
                </DndContext>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Group Management Modal */}
      <GroupModal
        open={groupModalOpen}
        onOpenChange={(open) => {
          setGroupModalOpen(open);
          if (!open) setEditingGroup(null);
        }}
        group={editingGroup}
        onSave={(payload) => {
          if (editingGroup) {
            updateGroupMutation.mutate({
              id: editingGroup.id,
              payload: payload as InventoryGroupUpdate,
            });
          } else {
            createGroupMutation.mutate(payload as InventoryGroupCreate);
          }
        }}
        isSaving={
          createGroupMutation.isPending || updateGroupMutation.isPending
        }
      />

      {/* Delete Group Confirmation */}
      {deleteGroupId && (
        <Dialog
          open={!!deleteGroupId}
          onOpenChange={(open) => !open && setDeleteGroupId(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Group?</DialogTitle>
            </DialogHeader>
            <p>
              This will remove the group but keep all inventory items. Items will
              become ungrouped.
            </p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteGroupId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteGroupMutation.mutate(deleteGroupId!);
                }}
                disabled={deleteGroupMutation.isPending}
              >
                {deleteGroupMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Add/Edit Requirement Modal */}
      <RequirementModal
        open={requirementModalOpen}
        onOpenChange={(open) => {
          setRequirementModalOpen(open);
          if (!open) setEditingRequirement(null);
        }}
        requirement={editingRequirement}
        onSave={(payload) => {
          if (editingRequirement) {
            updateRequirementMutation.mutate({
              id: editingRequirement.id,
              payload: payload as InventoryRequirementUpdate,
            });
          } else {
            createRequirementMutation.mutate(payload as InventoryRequirementCreate);
          }
        }}
        onDelete={
          editingRequirement
            ? () => {
                setDeleteRequirementId(editingRequirement.id);
                setRequirementModalOpen(false);
                setEditingRequirement(null);
              }
            : undefined
        }
        isSaving={
          createRequirementMutation.isPending ||
          updateRequirementMutation.isPending
        }
        vesselId={vesselId}
      />

      {/* Delete Confirmation */}
      {deleteRequirementId && (
        <Dialog
          open={!!deleteRequirementId}
          onOpenChange={(open) => !open && setDeleteRequirementId(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Requirement?</DialogTitle>
            </DialogHeader>
            <p>This action cannot be undone.</p>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteRequirementId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteRequirementMutation.mutate(deleteRequirementId!);
                }}
                disabled={deleteRequirementMutation.isPending}
              >
                {deleteRequirementMutation.isPending
                  ? "Deleting..."
                  : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      <ImportDialog
        open={importRequirementOpen}
        onOpenChange={setImportRequirementOpen}
        title="Import Inventory Requirements"
        description="Upload a CSV or Excel file to import multiple inventory requirements at once."
        exampleColumns={[
          "item_name (required)",
          "required_quantity (required, default: 1)",
          "category (optional)",
          "critical (optional, default: false)",
          "notes (optional)",
        ]}
        onImport={async (file) => await api.importInventoryRequirements(vesselId, file)}
        onSuccess={(result) => {
          if (result.success && result.created_count > 0) {
            toast.success(`Successfully imported ${result.created_count} requirement(s)`);
            queryClient.invalidateQueries({
              queryKey: ["inventory-requirements", vesselId],
            });
          }
          if (result.error_count > 0) {
            toast.error(`${result.error_count} error(s) occurred during import`);
          }
        }}
      />
    </div>
  );
}

function RequirementModal({
  open,
  onOpenChange,
  requirement,
  onSave,
  onDelete,
  isSaving,
  vesselId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: InventoryRequirement | null;
  onSave: (payload: InventoryRequirementCreate | InventoryRequirementUpdate) => void;
  onDelete?: (id: number) => void;
  isSaving: boolean;
  vesselId: number;
}) {
  const api = useApi();
  const [formData, setFormData] = useState({
    item_name: "",
    required_quantity: 1,
    category: "",
    critical: false,
    notes: "",
    parent_group_id: null as number | null,
  });
  const [errors, setErrors] = useState<{ item_name?: string }>({});
  const [showHistory, setShowHistory] = useState(false);

  const { data: groups } = useQuery({
    queryKey: ["inventory-groups", vesselId],
    queryFn: () => api.listInventoryGroups(vesselId),
    enabled: !!vesselId,
  });

  const { data: history, isLoading: historyLoading } = useQuery<InventoryCheckLine[]>({
    queryKey: ["requirement-history", requirement?.id],
    queryFn: () => api.getRequirementHistory(requirement!.id),
    enabled: !!requirement && showHistory,
  });

  useEffect(() => {
    if (requirement) {
      setFormData({
        item_name: requirement.item_name,
        required_quantity: requirement.required_quantity,
        category: requirement.category || "",
        critical: requirement.critical,
        notes: requirement.notes || "",
        parent_group_id: requirement.parent_group_id,
      });
    } else {
      setFormData({
        item_name: "",
        required_quantity: 1,
        category: "",
        critical: false,
        notes: "",
        parent_group_id: null,
      });
    }
    setErrors({});
    setShowHistory(false);
  }, [requirement, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_name.trim()) {
      setErrors({ item_name: "Item name is required" });
      return;
    }
    onSave({
      item_name: formData.item_name,
      required_quantity: formData.required_quantity,
      category: formData.category || null,
      critical: formData.critical,
      notes: formData.notes || null,
      parent_group_id: formData.parent_group_id,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {requirement ? "Edit Requirement" : "Add Requirement"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Item Name *
              </label>
              <Input
                value={formData.item_name}
                onChange={(e) => {
                  setFormData({ ...formData, item_name: e.target.value });
                  if (errors.item_name) setErrors({});
                }}
                placeholder="Item name"
                required
              />
              {errors.item_name && (
                <p className="text-sm text-destructive mt-1">
                  {errors.item_name}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Required Quantity *
              </label>
              <Input
                type="number"
                value={formData.required_quantity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    required_quantity: parseInt(e.target.value) || 0,
                  })
                }
                min="0"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Input
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                placeholder="Category"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Group</label>
              <Select
                value={formData.parent_group_id?.toString() || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    parent_group_id: e.target.value
                      ? parseInt(e.target.value, 10)
                      : null,
                  })
                }
              >
                <option value="">No Group</option>
                {groups?.map((group) => (
                  <option key={group.id} value={group.id.toString()}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="critical"
                checked={formData.critical}
                onChange={(e) =>
                  setFormData({ ...formData, critical: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="critical" className="text-sm font-medium">
                Critical
              </label>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Notes</label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Notes"
                rows={3}
              />
            </div>
            {requirement && (
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium">History</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                  >
                    {showHistory ? "Hide" : "Show"} History
                  </Button>
                </div>
                {showHistory && (
                  <div className="mt-2 max-h-60 overflow-y-auto">
                    {historyLoading ? (
                      <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : !history || history.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No history yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {history.map((line: InventoryCheckLine) => (
                          <div
                            key={line.id}
                            className="text-sm border rounded p-2 bg-muted/50"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">
                                  Quantity: {line.actual_quantity}
                                </p>
                                {line.condition !== "ok" && (
                                  <Badge
                                    variant={
                                      line.condition === "missing"
                                        ? "destructive"
                                        : "secondary"
                                    }
                                    className="text-xs mt-1"
                                  >
                                    {line.condition}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(line.updated_at), "PPp")}
                              </p>
                            </div>
                            {line.notes && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {line.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex gap-2 order-last sm:order-none w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
            {requirement && onDelete && (
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => onDelete(requirement.id)}
                disabled={isSaving}
              >
                Delete requirement
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GroupModal({
  open,
  onOpenChange,
  group,
  onSave,
  onDelete,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: InventoryGroup | null;
  onSave: (payload: InventoryGroupCreate | InventoryGroupUpdate) => void;
  onDelete?: (id: number) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (group) {
      setFormData({
        name: group.name,
        description: group.description || "",
      });
    } else {
      setFormData({
        name: "",
        description: "",
      });
    }
    setErrors({});
  }, [group, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrors({ name: "Group name is required" });
      return;
    }
    onSave({
      name: formData.name,
      description: formData.description || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {group ? "Edit Group" : "Add Group"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Group Name *
              </label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors({});
                }}
                placeholder="Group name (e.g., Bridge, Galley, Engine Room)"
                required
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {errors.name}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <div className="flex gap-2 order-last sm:order-none w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
            {group && onDelete && (
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => onDelete(group.id)}
                disabled={isSaving}
              >
                Delete group
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InventoryCheckView({
  check,
  requirements,
  onSave,
  onSubmit,
  onCancel,
  isSaving,
  isSubmitting,
}: {
  check: any;
  requirements: InventoryRequirement[];
  onSave: (lines: InventoryCheckLineCreate[]) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSaving: boolean;
  isSubmitting: boolean;
}) {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initialQuantities: Record<number, number> = {};
    check.lines.forEach((line: any) => {
      initialQuantities[line.requirement_id] = line.actual_quantity;
    });
    requirements.forEach((req) => {
      if (initialQuantities[req.id] === undefined) {
        initialQuantities[req.id] = 0;
      }
    });
    setQuantities(initialQuantities);
  }, [check, requirements]);

  const saveQuantities = () => {
    const checkLines: InventoryCheckLineCreate[] = requirements.map((req) => ({
      requirement_id: req.id,
      actual_quantity: quantities[req.id] || 0,
      condition: "ok" as const,
      notes: null,
    }));
    onSave(checkLines);
    setLastSaved(new Date());
  };

  const updateQuantity = (requirementId: number, newQuantity: number) => {
    const updated = {
      ...quantities,
      [requirementId]: Math.max(0, newQuantity),
    };
    setQuantities(updated);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Auto-save after 500ms delay
    saveTimeoutRef.current = setTimeout(() => {
      // Use the updated quantities from closure
      const checkLines: InventoryCheckLineCreate[] = requirements.map((req) => ({
        requirement_id: req.id,
        actual_quantity: req.id === requirementId ? newQuantity : (quantities[req.id] || 0),
        condition: "ok" as const,
        notes: null,
      }));
      onSave(checkLines);
      setLastSaved(new Date());
    }, 500);
  };

  const incrementQuantity = (requirementId: number) => {
    updateQuantity(requirementId, (quantities[requirementId] || 0) + 1);
  };

  const decrementQuantity = (requirementId: number) => {
    updateQuantity(requirementId, Math.max(0, (quantities[requirementId] || 0) - 1));
  };

  const handleSubmit = () => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    // Save one final time before submitting with current quantities
    const checkLines: InventoryCheckLineCreate[] = requirements.map((req) => ({
      requirement_id: req.id,
      actual_quantity: quantities[req.id] || 0,
      condition: "ok" as const,
      notes: null,
    }));
    onSave(checkLines);
    // Then submit after a brief delay
    setTimeout(() => onSubmit(), 200);
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Inventory Check</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Started: {format(new Date(check.performed_at), "PPp")}
              </p>
              {lastSaved && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last saved: {format(lastSaved, "h:mm:ss a")}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Check"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {requirements.map((req) => {
              const currentQty = quantities[req.id] || 0;
              const isMissing = currentQty < req.required_quantity;
              return (
                <div
                  key={req.id}
                  className={`border rounded-lg p-4 ${
                    req.critical && isMissing
                      ? "border-destructive bg-destructive/5"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{req.item_name}</h4>
                        {req.critical && (
                          <Badge variant="destructive" className="text-xs">
                            Critical
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Required: {req.required_quantity}
                        {isMissing && (
                          <span className="text-destructive ml-2">
                            ({req.required_quantity - currentQty} missing)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => decrementQuantity(req.id)}
                        disabled={currentQty === 0}
                        className="h-8 w-8 p-0"
                      >
                        −
                      </Button>
                      <Input
                        type="number"
                        value={currentQty}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          updateQuantity(req.id, value);
                        }}
                        onBlur={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          updateQuantity(req.id, value);
                        }}
                        min="0"
                        className="w-20 text-center"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => incrementQuantity(req.id)}
                        className="h-8 w-8 p-0"
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MaintenanceTab({ vesselId }: { vesselId: number }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [logTaskId, setLogTaskId] = useState<number | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [viewingLogsTaskId, setViewingLogsTaskId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "overdue" | "due_soon" | "active">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [importTaskOpen, setImportTaskOpen] = useState(false);

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["maintenance-tasks", vesselId],
    queryFn: () => api.listMaintenanceTasks(vesselId),
  });

  // Fetch latest log for each task to show last completion date
  const taskIds = React.useMemo(() => tasks?.map((t) => t.id) || [], [tasks]);
  const logQueries = useQueries({
    queries: taskIds.map((taskId) => ({
      queryKey: ["maintenance-logs", taskId],
      queryFn: () => api.listMaintenanceLogs(taskId),
      enabled: !!taskId && taskIds.length > 0,
    })),
  });

  // Create a map of taskId -> latest log
  const latestLogsMap = React.useMemo(() => {
    const map: Record<number, MaintenanceLog | null> = {};
    logQueries.forEach((query, index) => {
      if (query.data && query.data.length > 0) {
        map[taskIds[index]] = query.data[0]; // Logs are ordered desc, so first is latest
      }
    });
    return map;
  }, [logQueries, taskIds]);

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const filteredTasks = React.useMemo(() => {
    let list = tasks ?? [];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (task) =>
          task.name.toLowerCase().includes(q) ||
          (task.description ?? "").toLowerCase().includes(q)
      );
    }
    return list.filter((task) => {
      if (!task.is_active && filter === "active") return false;
      if (filter === "all") return true;
      if (filter === "active") return task.is_active;
      if (!task.next_due_at) return false;
      const dueDate = new Date(task.next_due_at);
      if (filter === "overdue") return dueDate < now;
      if (filter === "due_soon")
        return dueDate <= sevenDaysFromNow && dueDate >= now;
      return true;
    });
  }, [tasks, searchQuery, filter, now, sevenDaysFromNow]);

  const overdueCount = tasks?.filter(
    (task) => task.next_due_at && new Date(task.next_due_at) < now
  ).length || 0;
  const dueSoonCount = tasks?.filter(
    (task) =>
      task.next_due_at &&
      new Date(task.next_due_at) <= sevenDaysFromNow &&
      new Date(task.next_due_at) >= now
  ).length || 0;

  const createTaskMutation = useMutation({
    mutationFn: (payload: any) => api.createMaintenanceTask(vesselId, payload),
    onSuccess: () => {
      toast.success("Task created successfully");
      queryClient.invalidateQueries({
        queryKey: ["maintenance-tasks", vesselId],
      });
      setTaskModalOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create task");
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      api.updateMaintenanceTask(id, payload),
    onSuccess: () => {
      toast.success("Task updated successfully");
      queryClient.invalidateQueries({
        queryKey: ["maintenance-tasks", vesselId],
      });
      setTaskModalOpen(false);
      setEditingTask(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update task");
    },
  });

  const createLogMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: number; payload: any }) =>
      api.createMaintenanceLog(taskId, payload),
    onSuccess: () => {
      toast.success("Maintenance logged successfully");
      queryClient.invalidateQueries({
        queryKey: ["maintenance-tasks", vesselId],
      });
      // Invalidate all maintenance log queries to refresh last completed dates
      queryClient.invalidateQueries({
        queryKey: ["maintenance-logs"],
      });
      setLogModalOpen(false);
      setLogTaskId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to log maintenance");
    },
  });

  const reorderTasksMutation = useMutation({
    mutationFn: (taskIds: number[]) =>
      api.reorderMaintenanceTasks(vesselId, taskIds),
    onMutate: async (taskIds) => {
      await queryClient.cancelQueries({
        queryKey: ["maintenance-tasks", vesselId],
      });
      const prev = queryClient.getQueryData<any[]>([
        "maintenance-tasks",
        vesselId,
      ]);
      if (!prev) return { prev };
      const orderMap = new Map(taskIds.map((id, i) => [id, i]));
      const sorted = [...prev].sort((a, b) => {
        const oa = orderMap.get(a.id) ?? 9999;
        const ob = orderMap.get(b.id) ?? 9999;
        return oa - ob;
      });
      queryClient.setQueryData(["maintenance-tasks", vesselId], sorted);
      return { prev };
    },
    onError: (_err, _taskIds, ctx) => {
      if (ctx?.prev)
        queryClient.setQueryData(
          ["maintenance-tasks", vesselId],
          ctx.prev
        );
      toast.error("Failed to reorder tasks");
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ["maintenance-tasks", vesselId],
      });
    },
  });

  const maintenanceSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleMaintenanceTaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const filteredIds = (filteredTasks ?? []).map((t) => t.id);
    const oldIndex = filteredIds.indexOf(Number(active.id));
    const newIndex = filteredIds.indexOf(Number(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newFilteredOrder = arrayMove(filteredIds, oldIndex, newIndex);
    const allIds = (tasks ?? []).map((t) => t.id);
    const filteredSet = new Set(filteredIds);
    const filteredIndices = allIds
      .map((id, i) => (filteredSet.has(id) ? i : -1))
      .filter((i) => i >= 0);
    const newAllOrder = allIds.slice();
    newFilteredOrder.forEach((id, j) => {
      newAllOrder[filteredIndices[j]] = id;
    });
    reorderTasksMutation.mutate(newAllOrder);
  };

  const canEditMaintenance = true;

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ["maintenance-logs", viewingLogsTaskId],
    queryFn: () => api.listMaintenanceLogs(viewingLogsTaskId!),
    enabled: !!viewingLogsTaskId,
  });

  const getTaskStatus = (task: any) => {
    if (!task.next_due_at) return { label: "No due date", variant: "outline" as const };
    const dueDate = new Date(task.next_due_at);
    if (dueDate < now) return { label: "Overdue", variant: "destructive" as const };
    if (dueDate <= sevenDaysFromNow) return { label: "Due soon", variant: "secondary" as const };
    return { label: "OK", variant: "outline" as const };
  };

  return (
    <div className="space-y-6">
      {/* Status Summary */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Maintenance Status</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportTaskOpen(true)}>
                Import
              </Button>
              <Button onClick={() => setTaskModalOpen(true)}>Add Task</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
              <p className="text-sm text-muted-foreground">Overdue</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{dueSoonCount}</p>
              <p className="text-sm text-muted-foreground">Due soon</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {tasks?.filter((t) => t.is_active).length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Active tasks</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Tasks</CardTitle>
            <div className="flex flex-wrap gap-2 items-center">
              <Input
                type="search"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 max-w-full"
                aria-label="Search maintenance tasks"
              />
              <Select
                value={filter}
                onChange={(e) =>
                  setFilter(
                    e.target.value as "all" | "overdue" | "due_soon" | "active"
                  )
                }
                className="w-32"
              >
                <option value="all">All</option>
                <option value="overdue">Overdue</option>
                <option value="due_soon">Due soon</option>
                <option value="active">Active</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !filteredTasks || filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                {filter === "all" && !searchQuery.trim()
                  ? "No maintenance tasks yet."
                  : searchQuery.trim()
                  ? "No tasks match your search."
                  : `No ${filter.replace("_", " ")} tasks.`}
              </p>
              {filter === "all" && !searchQuery.trim() && (
                <Button onClick={() => setTaskModalOpen(true)}>
                  Add your first maintenance task
                </Button>
              )}
            </div>
          ) : (
            <DndContext
              sensors={maintenanceSensors}
              onDragEnd={handleMaintenanceTaskDragEnd}
            >
              <SortableContext
                items={filteredTasks.map((t) => String(t.id))}
                strategy={verticalListSortingStrategy}
              >
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 w-10" aria-label="Reorder" />
                        <th className="text-left p-2">Task</th>
                        <th className="text-left p-2">Cadence</th>
                        <th className="text-left p-2">Next Due</th>
                        <th className="text-left p-2">Last Completed</th>
                        <th className="text-left p-2">Critical</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((task) => {
                        const status = getTaskStatus(task);
                        const cadenceText =
                          task.cadence_type === "interval"
                            ? `Every ${task.interval_days} days`
                            : task.due_date
                            ? `Due on ${format(new Date(task.due_date), "yyyy-MM-dd")}`
                            : "No cadence";
                        return (
                          <SortableMaintenanceRow
                            key={task.id}
                            id={task.id}
                            disabled={!canEditMaintenance}
                          >
                            <td className="p-2">
                              <div>
                                <p className="font-medium">{task.name}</p>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="p-2">{cadenceText}</td>
                            <td className="p-2">
                              {task.next_due_at
                                ? format(new Date(task.next_due_at), "PPp")
                                : "-"}
                            </td>
                            <td className="p-2">
                              {latestLogsMap[task.id] ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">
                                    {format(
                                      new Date(latestLogsMap[task.id]!.performed_at),
                                      "PPp"
                                    )}
                                  </span>
                                  <span
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-primary text-primary-foreground"
                                    title={
                                      latestLogsMap[task.id]!.performed_by_name ||
                                      latestLogsMap[task.id]!.performed_by_email ||
                                      "Unknown user"
                                    }
                                  >
                                    {getUserInitials(
                                      latestLogsMap[task.id]!.performed_by_name,
                                      latestLogsMap[task.id]!.performed_by_email
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">
                                  Never
                                </span>
                              )}
                            </td>
                            <td className="p-2">
                              {task.critical ? (
                                <Badge variant="destructive">Critical</Badge>
                              ) : (
                                "-"
                              )}
                            </td>
                            <td className="p-2">
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </td>
                            <td className="p-2">
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    setLogTaskId(task.id);
                                    setLogModalOpen(true);
                                  }}
                                  disabled={!task.is_active}
                                >
                                  Log Completion
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setViewingLogsTaskId(
                                      viewingLogsTaskId === task.id ? null : task.id
                                    );
                                  }}
                                >
                                  {viewingLogsTaskId === task.id ? "Hide" : "View"} Logs
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingTask(task);
                                    setTaskModalOpen(true);
                                  }}
                                >
                                  Edit
                                </Button>
                              </div>
                            </td>
                          </SortableMaintenanceRow>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Logs View */}
      {viewingLogsTaskId && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                Logs for {tasks?.find((t) => t.id === viewingLogsTaskId)?.name}
              </CardTitle>
              <Button
                variant="outline"
                onClick={() => setViewingLogsTaskId(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : !logs || logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No logs yet for this task.
              </p>
            ) : (
              <div className="space-y-3">
                {logs.map((log: MaintenanceLog) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 bg-muted/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {format(new Date(log.performed_at), "PPp")}
                        </span>
                        {(log.performed_by_name || log.performed_by_email) && (
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-primary text-primary-foreground"
                            title={
                              log.performed_by_name ||
                              log.performed_by_email ||
                              "Unknown user"
                            }
                          >
                            {getUserInitials(
                              log.performed_by_name,
                              log.performed_by_email
                            )}
                          </span>
                        )}
                        {(log.performed_by_name || log.performed_by_email) && (
                          <span className="text-sm text-muted-foreground">
                            {log.performed_by_name ||
                              log.performed_by_email ||
                              `User ${log.performed_by_user_id}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {log.notes && (
                      <p className="text-sm mt-2">{log.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Task Modal */}
      <TaskModal
        open={taskModalOpen}
        onOpenChange={(open) => {
          setTaskModalOpen(open);
          if (!open) setEditingTask(null);
        }}
        task={editingTask}
        onSave={(payload) => {
          if (editingTask) {
            updateTaskMutation.mutate({ id: editingTask.id, payload });
          } else {
            createTaskMutation.mutate(payload);
          }
        }}
        isSaving={
          createTaskMutation.isPending || updateTaskMutation.isPending
        }
      />

      {/* Log Completion Modal */}
      {logTaskId && (
        <LogModal
          open={logModalOpen}
          onOpenChange={(open) => {
            setLogModalOpen(open);
            if (!open) setLogTaskId(null);
          }}
          taskId={logTaskId}
          onSave={(payload) =>
            createLogMutation.mutate({ taskId: logTaskId, payload })
          }
          isSaving={createLogMutation.isPending}
        />
      )}
      
      <ImportDialog
        open={importTaskOpen}
        onOpenChange={setImportTaskOpen}
        title="Import Maintenance Tasks"
        description="Upload a CSV or Excel file to import multiple maintenance tasks at once."
        exampleColumns={[
          "name (required)",
          "description (optional)",
          "cadence_type (required: 'interval' or 'specific_date')",
          "interval_days (required if cadence_type='interval')",
          "due_date (required if cadence_type='specific_date', format: YYYY-MM-DD)",
          "critical (optional, default: false)",
          "is_active (optional, default: true)",
        ]}
        onImport={async (file) => await api.importMaintenanceTasks(vesselId, file)}
        onSuccess={(result) => {
          if (result.success && result.created_count > 0) {
            toast.success(`Successfully imported ${result.created_count} task(s)`);
            queryClient.invalidateQueries({
              queryKey: ["maintenance-tasks", vesselId],
            });
          }
          if (result.error_count > 0) {
            toast.error(`${result.error_count} error(s) occurred during import`);
          }
        }}
      />
    </div>
  );
}

function TaskModal({
  open,
  onOpenChange,
  task,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: any;
  onSave: (payload: any) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cadence_type: "interval" as "interval" | "specific_date",
    interval_days: 90,
    due_date: "",
    critical: false,
    is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name,
        description: task.description || "",
        cadence_type: task.cadence_type,
        interval_days: task.interval_days || 90,
        due_date: task.due_date
          ? format(new Date(task.due_date), "yyyy-MM-dd")
          : "",
        critical: task.critical,
        is_active: task.is_active,
      });
    } else {
      setFormData({
        name: "",
        description: "",
        cadence_type: "interval",
        interval_days: 90,
        due_date: "",
        critical: false,
        is_active: true,
      });
    }
    setErrors({});
  }, [task, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    if (formData.cadence_type === "interval" && !formData.interval_days) {
      newErrors.interval_days = "Interval days is required";
    }
    if (formData.cadence_type === "specific_date" && !formData.due_date) {
      newErrors.due_date = "Due date is required";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      name: formData.name,
      description: formData.description || null,
      cadence_type: formData.cadence_type,
      interval_days:
        formData.cadence_type === "interval" ? formData.interval_days : null,
      due_date:
        formData.cadence_type === "specific_date"
          ? new Date(formData.due_date).toISOString()
          : null,
      critical: formData.critical,
      is_active: formData.is_active,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit Task" : "Add Task"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: "" });
                }}
                placeholder="Task name"
                required
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">{errors.name}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Description"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Cadence Type *
              </label>
              <Select
                value={formData.cadence_type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cadence_type: e.target.value as "interval" | "specific_date",
                  })
                }
              >
                <option value="interval">Interval</option>
                <option value="specific_date">Specific Date</option>
              </Select>
            </div>
            {formData.cadence_type === "interval" ? (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Interval Days *
                </label>
                <Input
                  type="number"
                  value={formData.interval_days}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      interval_days: parseInt(e.target.value) || 0,
                    })
                  }
                  min="1"
                  required
                />
                {errors.interval_days && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.interval_days}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Due Date *
                </label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) =>
                    setFormData({ ...formData, due_date: e.target.value })
                  }
                  required
                />
                {errors.due_date && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.due_date}
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="critical"
                checked={formData.critical}
                onChange={(e) =>
                  setFormData({ ...formData, critical: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="critical" className="text-sm font-medium">
                Critical
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm font-medium">
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LogModal({
  open,
  onOpenChange,
  taskId,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: number;
  onSave: (payload: any) => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    performed_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setFormData({
        performed_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        notes: "",
      });
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      performed_at: new Date(formData.performed_at).toISOString(),
      notes: formData.notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Completion</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Performed At
              </label>
              <Input
                type="datetime-local"
                value={formData.performed_at}
                onChange={(e) =>
                  setFormData({ ...formData, performed_at: e.target.value })
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                Comment or Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Add any comments or notes about this maintenance completion..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Log Completion"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CommentsTab({ vesselId }: { vesselId: number }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ["vessel-comments", vesselId],
    queryFn: () => api.listVesselComments(vesselId),
  });

  const createCommentMutation = useMutation({
    mutationFn: (payload: { body: string }) =>
      api.createVesselComment(vesselId, payload),
    onSuccess: () => {
      toast.success("Comment posted");
      queryClient.invalidateQueries({
        queryKey: ["vessel-comments", vesselId],
      });
      setCommentText("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to post comment");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    createCommentMutation.mutate({ body: commentText });
  };

  return (
    <div className="space-y-6">
      {/* Add Comment */}
      <Card>
        <CardHeader>
          <CardTitle>Add Comment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              rows={4}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={!commentText.trim() || createCommentMutation.isPending}
              >
                {createCommentMutation.isPending ? "Posting..." : "Post"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Comments List */}
      <Card>
        <CardHeader>
          <CardTitle>Comments</CardTitle>
        </CardHeader>
        <CardContent>
          {commentsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : !comments || comments.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No comments yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="border-b pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium">User {comment.user_id}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(comment.created_at), "PPp")}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VesselDetailPage() {
  const params = useParams();
  const router = useRouter();
  const api = useApi();
  const vesselId = parseInt(params.id as string);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: vessel, isLoading, error } = useQuery({
    queryKey: ["vessels", vesselId],
    queryFn: () => api.getVessel(vesselId),
    enabled: !!vesselId && !isNaN(vesselId),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/4 animate-pulse"></div>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/2"></div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-destructive">
            Error loading vessel: {error.message}
          </p>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="mt-4"
          >
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!vessel) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>Vessel not found</p>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
            className="mt-4"
          >
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    );
  }

  const makeModelYear = [vessel.make, vessel.model, vessel.year?.toString()]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <div className="mt-2">
          <h1 className="text-3xl font-bold">{vessel.name}</h1>
          {makeModelYear && (
            <p className="text-lg text-muted-foreground mt-1">{makeModelYear}</p>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab vessel={vessel} />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryTab vesselId={vesselId} />
        </TabsContent>
        <TabsContent value="maintenance">
          <MaintenanceTab vesselId={vesselId} />
        </TabsContent>
        <TabsContent value="comments">
          <CommentsTab vesselId={vesselId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
