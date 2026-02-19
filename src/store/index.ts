import { useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import { applyNodeChanges, applyEdgeChanges } from "@xyflow/react";
import type { MindStore, MindNode, MindEdge, ProjectData } from "@/types";
import { applyRadialLayout } from "@/lib/layout";
import { fetchProject, deleteProject as deleteProjectApi } from "@/lib/api";

let nodeCounter = 0;

const NODE_SIZE_FALLBACK: Record<string, { w: number; h: number }> = {
  root: { w: 160, h: 56 },
  domain: { w: 170, h: 50 },
  goal: { w: 190, h: 76 },
  feature: { w: 180, h: 70 },
  task: { w: 180, h: 70 },
};
const TASK_CARD_MAX_WIDTH = 380;
const TASK_CARD_INNER_MAX_WIDTH = 300;
const TASK_CARD_INNER_MIN_WIDTH = 120;
const TASK_CARD_TEXT_CHAR_WIDTH = 6.15;
const TASK_CARD_EXTRA_LINE_HEIGHT = 16;
const TASK_CARD_MAX_HEIGHT = 220;

function nodeCenter(node: MindNode) {
  const size = nodeDims(node);
  return {
    x: node.position.x + size.w / 2,
    y: node.position.y + size.h / 2,
  };
}

function nodeDims(node: MindNode) {
  const label = node.data.label?.trim() || "Untitled";
  if (node.data.type === "goal" || node.data.type === "feature" || node.data.type === "task") {
    const fallback = NODE_SIZE_FALLBACK[node.data.type] ?? NODE_SIZE_FALLBACK.task;
    const rawTextWidth = Math.max(52, label.length * TASK_CARD_TEXT_CHAR_WIDTH);
    const innerWidth = Math.min(
      TASK_CARD_INNER_MAX_WIDTH,
      Math.max(TASK_CARD_INNER_MIN_WIDTH, rawTextWidth),
    );
    const lines = Math.max(1, Math.ceil(rawTextWidth / innerWidth));
    return {
      w: Math.min(TASK_CARD_MAX_WIDTH, Math.max(fallback.w, innerWidth + 38)),
      h: Math.min(
        TASK_CARD_MAX_HEIGHT,
        fallback.h + Math.max(0, lines - 1) * TASK_CARD_EXTRA_LINE_HEIGHT,
      ),
    };
  }

  const fallback = NODE_SIZE_FALLBACK[node.data.type] ?? NODE_SIZE_FALLBACK.task;
  return {
    w: node.measured?.width ?? fallback.w,
    h: node.measured?.height ?? fallback.h,
  };
}

function rectClearance(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  if (dx === 0 && dy === 0) {
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return -Math.min(overlapX, overlapY);
  }
  return Math.hypot(dx, dy);
}

function normalizeAngle(angle: number) {
  const full = Math.PI * 2;
  let next = angle % full;
  if (next < 0) next += full;
  return next;
}

function angleDistance(a: number, b: number) {
  let diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff;
}

function largestGapMidAngle(angles: number[]) {
  if (angles.length === 0) return null;
  if (angles.length === 1) return normalizeAngle(angles[0] + Math.PI);

  const sorted = [...angles].map(normalizeAngle).sort((x, y) => x - y);
  let bestGap = -1;
  let bestMid = sorted[0];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = i === sorted.length - 1 ? sorted[0] + Math.PI * 2 : sorted[i + 1];
    const gap = next - current;
    if (gap > bestGap) {
      bestGap = gap;
      bestMid = current + gap / 2;
    }
  }

  return normalizeAngle(bestMid);
}

// Stable hooks for derived data — avoids infinite re-renders with React 19
export function useActiveProject() {
  const projects = useStore(useShallow((s) => s.projects));
  const activeProjectId = useStore((s) => s.activeProjectId);
  return useMemo(
    () => projects.find((p) => p.id === activeProjectId),
    [projects, activeProjectId],
  );
}

export function useSelectedNode() {
  const project = useActiveProject();
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  return useMemo(
    () => project?.nodes.find((n) => n.id === selectedNodeId),
    [project, selectedNodeId],
  );
}

export function useActiveEdges() {
  const project = useActiveProject();
  return project?.edges ?? emptyEdges;
}

const emptyEdges: MindEdge[] = [];

export const useStore = create<MindStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  selectedNodeId: null,
  editingNodeId: null,
  layoutVersion: 0,
  saveStatus: "saved",
  saveError: null,
  searchQuery: "",
  focusedNodeId: null,
  sidebarCollapsed: false,
  autoFocusEnabled: true,
  confirmationModal: {
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  },
  connectMode: "off",
  connectSourceId: null,

  activeProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find((p) => p.id === activeProjectId);
  },

  selectedNode: () => {
    const project = get().activeProject();
    const { selectedNodeId } = get();
    if (!project || !selectedNodeId) return undefined;
    return project.nodes.find((n) => n.id === selectedNodeId);
  },

  setProjects: (projects) => {
    set({ projects });
    if (!get().activeProjectId && projects.length > 0) {
      set({ activeProjectId: projects[0].id });
    }
  },

  setActiveProject: async (id) => {
    const existing = get().projects.find((p) => p.id === id);

    // If we only have summary data (no nodes), fetch the full project
    if (existing && existing.nodes.length === 0) {
      try {
        set({ saveStatus: "saving", activeProjectId: id, selectedNodeId: null, editingNodeId: null, focusedNodeId: null, searchQuery: "" });
        const fullProject = await fetchProject(id);
        // Re-read projects after await to avoid stale closure
        set({
          projects: get().projects.map((p) => (p.id === id ? fullProject : p)),
          saveStatus: "saved",
        });
      } catch (err) {
        set({ saveStatus: "error", saveError: "Failed to load project" });
        return;
      }
    } else {
      set({ activeProjectId: id, selectedNodeId: null, editingNodeId: null, focusedNodeId: null, searchQuery: "" });
    }
  },

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  setEditingNode: (id) => set({ editingNodeId: id }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setFocusedNode: (id) => set({ focusedNodeId: id }),

  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  setAutoFocusEnabled: (autoFocusEnabled) => set({ autoFocusEnabled }),

  openConfirmationModal: (options) => set({
    confirmationModal: { ...options, isOpen: true }
  }),

  closeConfirmationModal: () => set({
    confirmationModal: { ...get().confirmationModal, isOpen: false }
  }),

  setConnectMode: (mode) => set({ connectMode: mode, connectSourceId: null }),

  setConnectSource: (id) => set({ connectSourceId: id }),

  setSaveStatus: (status, error = null) =>
    set({ saveStatus: status, saveError: error }),

  clearSaveError: () => set({ saveStatus: "saved", saveError: null }),

  onNodesChange: (changes) => {
    const project = get().activeProject();
    if (!project) return;

    const updatedNodes = applyNodeChanges(changes, project.nodes) as MindNode[];
    set({
      projects: get().projects.map((p) =>
        p.id === project.id ? { ...p, nodes: updatedNodes } : p,
      ),
    });
  },

  onEdgesChange: (changes) => {
    const project = get().activeProject();
    if (!project) return;

    const updatedEdges = applyEdgeChanges(changes, project.edges);
    set({
      projects: get().projects.map((p) =>
        p.id === project.id
          ? { ...p, edges: updatedEdges as ProjectData["edges"] }
          : p,
      ),
    });
  },

  updateNodeData: (nodeId, data) => {
    const project = get().activeProject();
    if (!project) return;

    set({
      projects: get().projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              nodes: p.nodes.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, ...data } }
                  : n,
              ),
            }
          : p,
      ),
    });
  },

  addChildNode: (parentId) => {
    const project = get().activeProject();
    if (!project) return;

    const parent = project.nodes.find((n) => n.id === parentId);
    if (!parent) return;

    const childTypeMap: Record<string, "domain" | "goal" | "feature" | "task"> = {
      root: "domain",
      domain: "feature",
      goal: "feature",
      feature: "task",
      task: "task",
    };
    const childType = childTypeMap[parent.data.type] ?? "task";
    const newId = `node-${Date.now()}-${++nodeCounter}`;

    const hierarchyEdges = project.edges.filter(
      (e) => e.data?.edgeType === "hierarchy",
    );
    const nodeById = new Map(project.nodes.map((node) => [node.id, node]));
    const children = hierarchyEdges
      .filter((edge) => edge.source === parentId)
      .map((edge) => nodeById.get(edge.target))
      .filter((node): node is MindNode => Boolean(node));

    const parentCenter = nodeCenter(parent);
    const root = project.nodes.find((node) => node.data.type === "root") ?? parent;
    const rootCenter = nodeCenter(root);

    let angle: number;
    let distance: number;

    const baseDistByParentType: Record<string, number> = {
      root: 240,
      domain: 180,
      goal: 160,
      feature: 148,
      task: 142,
    };
    distance = baseDistByParentType[parent.data.type] ?? 150;

    if (parent.id === root.id) {
      // Add domains sequentially in a circle
      const step = (Math.PI * 2) / Math.max(6, children.length + 1);
      angle = -Math.PI / 2 + children.length * step;
    } else {
      // Follow the direction of the parent from the root
      const dx = parentCenter.x - rootCenter.x;
      const dy = parentCenter.y - rootCenter.y;
      
      if (Math.hypot(dx, dy) < 1) {
        angle = Math.PI / 2; // Fallback
      } else {
        const parentAngle = Math.atan2(dy, dx);
        // Fan out children slightly based on index
        const fanStep = 0.25;
        const fanOffset = (children.length - (children.length / 2)) * fanStep;
        angle = parentAngle + fanOffset;
      }
    }

    const newNode: MindNode = {
      id: newId,
      type: childType,
      position: {
        x: parentCenter.x + Math.cos(angle) * distance - 80, // rough half width
        y: parentCenter.y + Math.sin(angle) * distance - 35, // rough half height
      },
      data: {
        label: "",
        type: childType,
        ...(childType === "task" || childType === "feature" || childType === "goal"
          ? { status: "pending" as const }
          : {}),
      },
    };

    const newEdge: MindEdge = {
      id: `e-${parentId}-${newId}`,
      source: parentId,
      target: newId,
      data: { edgeType: "hierarchy" },
    };

    set({
      selectedNodeId: newId,
      editingNodeId: newId,
      projects: get().projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              nodes: [...p.nodes, newNode],
              edges: [...p.edges, newEdge],
            }
          : p,
      ),
    });
  },

  addBlockingEdge: (sourceId, targetId) => {
    const project = get().activeProject();
    if (!project) return;
    if (sourceId === targetId) return;

    // Don't add duplicate blocking edges
    const exists = project.edges.some(
      (e) =>
        e.data?.edgeType === "blocks" &&
        e.source === sourceId &&
        e.target === targetId,
    );
    if (exists) return;

    const newEdge: MindEdge = {
      id: `e-blocks-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      data: { edgeType: "blocks" },
    };

    set({
      connectMode: "off",
      connectSourceId: null,
      projects: get().projects.map((p) =>
        p.id === project.id
          ? { ...p, edges: [...p.edges, newEdge] }
          : p,
      ),
    });
  },

  toggleGoal: (nodeId) => {
    const project = get().activeProject();
    if (!project) return;

    const node = project.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const isFeature = node.data.type === "feature";
    const isGoal = node.data.type === "goal";
    if (!isFeature && !isGoal) return;

    const nextType = isFeature ? "goal" : "feature";
    const childTargetType = isFeature ? "feature" : "task"; // if promoting to goal, children become features
    const childSourceType = isFeature ? "task" : "feature"; // if promoting to goal, children were tasks

    const updatedNodes = project.nodes.map((n) => {
      if (n.id === nodeId) {
        return { ...n, type: nextType, data: { ...n.data, type: nextType } };
      }
      // Re-type direct children
      const isDirectChild = project.edges.some(
        (e) =>
          e.source === nodeId &&
          e.target === n.id &&
          e.data?.edgeType === "hierarchy",
      );
      if (isDirectChild && n.data.type === childSourceType) {
        return { ...n, type: childTargetType, data: { ...n.data, type: childTargetType } };
      }
      return n;
    });

    set({
      projects: get().projects.map((p) =>
        p.id === project.id ? { ...p, nodes: updatedNodes as MindNode[] } : p,
      ),
    });
  },

  deleteNode: (nodeId) => {
    const project = get().activeProject();
    if (!project) return;

    const node = project.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // Check if node has descendants via hierarchy edges
    const hasChildren = project.edges.some(
      (e) => e.source === nodeId && e.data?.edgeType === "hierarchy"
    );

    if (hasChildren) {
      // Count descendants for the message
      const ids = new Set<string>();
      const collect = (id: string) => {
        for (const edge of project.edges) {
          if (edge.source === id && edge.data?.edgeType === "hierarchy" && !ids.has(edge.target)) {
            ids.add(edge.target);
            collect(edge.target);
          }
        }
      };
      collect(nodeId);
      const count = ids.size;

      get().openConfirmationModal({
        title: "Delete Node",
        message: `Are you sure you want to delete "${node.data.label || "Untitled"}" and its ${count} ${count === 1 ? "child" : "children"}?`,
        confirmLabel: "Delete Everything",
        variant: "danger",
        onConfirm: () => get().performDeleteNode(nodeId),
      });
    } else {
      // Single node with no children, delete immediately or could still confirm
      get().performDeleteNode(nodeId);
    }
  },

  performDeleteNode: (nodeId) => {
    const project = get().activeProject();
    if (!project) return;

    // Collect all descendant node IDs recursively via hierarchy edges
    const idsToDelete = new Set<string>();
    const collect = (id: string) => {
      idsToDelete.add(id);
      for (const edge of project.edges) {
        if (edge.source === id && edge.data?.edgeType === "hierarchy" && !idsToDelete.has(edge.target)) {
          collect(edge.target);
        }
      }
    };
    collect(nodeId);

    set({
      selectedNodeId: null,
      editingNodeId: null,
      projects: get().projects.map((p) =>
        p.id === project.id
          ? {
              ...p,
              nodes: p.nodes.filter((n) => !idsToDelete.has(n.id)),
              edges: p.edges.filter(
                (e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target),
              ),
            }
          : p,
      ),
    });
  },

  createProject: (name) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const rootId = `${id}-root`;

    const newProject: ProjectData = {
      id,
      name,
      nodes: [
        {
          id: rootId,
          type: "root",
          position: { x: 0, y: 0 },
          data: { label: name, type: "root" },
        },
      ],
      edges: [],
    };

    set({
      projects: [...get().projects, newProject],
      activeProjectId: id,
      selectedNodeId: null,
      editingNodeId: null,
    });
  },

  deleteProject: (id) => {
    const { projects } = get();
    const project = projects.find((p) => p.id === id);
    if (!project) return;

    get().openConfirmationModal({
      title: "Delete Project",
      message: `Are you sure you want to delete "${project.name}"? This action cannot be undone.`,
      confirmLabel: "Delete Project",
      variant: "danger",
      onConfirm: () => get().performDeleteProject(id),
    });
  },

  performDeleteProject: async (id) => {
    const { projects, activeProjectId } = get();
    
    try {
      set({ saveStatus: "saving" });
      await deleteProjectApi(id);
      
      const newProjects = projects.filter((p) => p.id !== id);
      set({
        projects: newProjects,
        saveStatus: "saved",
      });

      if (activeProjectId === id) {
        const nextId = newProjects.length > 0 ? newProjects[0].id : null;
        set({
          activeProjectId: nextId,
          selectedNodeId: null,
          editingNodeId: null,
          focusedNodeId: null,
        });
      }
      
      get().closeConfirmationModal();
    } catch (err) {
      set({ saveStatus: "error", saveError: "Failed to delete project" });
    }
  },

  applyLayout: (density = "balanced", onComplete) => {
    const project = get().activeProject();
    if (!project) return;

    const { nodes, edges } = applyRadialLayout(project.nodes, project.edges, density);
    set({
      layoutVersion: get().layoutVersion + 1,
      projects: get().projects.map((p) =>
        p.id === project.id ? { ...p, nodes, edges } : p,
      ),
    });

    if (onComplete) {
      // Use setTimeout to ensure the React Flow has received the new layout state
      setTimeout(onComplete, 0);
    }
  },
}));
